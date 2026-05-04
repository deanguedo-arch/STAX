import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  PullRequestArtifactPacketSchema,
  type PullRequestArtifactPacket
} from "./PullRequestArtifactPacket.js";

const GitHubPrRefSchema = z.object({
  repoFullName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  prNumber: z.number().int().positive()
});

const RecordedSnapshotFixtureSchema = z.object({
  snapshots: z.array(
    z.object({
      snapshotId: z.string().min(1),
      repoFullName: z.string().min(1),
      publicUrl: z.string().url(),
      sourceKind: z.string().min(1),
      capturedAt: z.string().datetime(),
      notes: z.string().min(1),
      packet: PullRequestArtifactPacketSchema
    })
  )
});

export type GitHubPrRef = z.infer<typeof GitHubPrRefSchema>;
export type PullRequestArtifactSource = "live_github_api" | "recorded_snapshot_fallback";
export type PullRequestArtifactFetchResult = {
  source: PullRequestArtifactSource;
  packet: PullRequestArtifactPacket;
  warnings: string[];
};

type GitHubPrArtifactFetchOptions = {
  rootDir?: string;
  fetchImpl?: FetchLike;
  githubToken?: string;
  mode?: "standard" | "live_trial";
  preferRecordedSnapshot?: boolean;
};

type FetchLike = typeof fetch;

type GitHubPullResponse = {
  number: number;
  title: string;
  body: string | null;
  head?: { ref?: string; sha?: string };
  base?: { ref?: string };
  labels?: Array<{ name?: string }>;
};

type GitHubPullFileResponse = {
  filename: string;
  patch?: string;
};

type GitHubReviewCommentResponse = {
  user?: { login?: string };
  path?: string;
  body?: string;
};

type GitHubCheckRunsResponse = {
  check_runs?: Array<{
    name?: string;
    status?: string;
    conclusion?: string | null;
    head_sha?: string;
    started_at?: string | null;
    completed_at?: string | null;
    details_url?: string | null;
    output?: { title?: string | null; summary?: string | null };
  }>;
};

type GitHubWorkflowRunsResponse = {
  workflow_runs?: Array<{
    id: number;
    name?: string;
    status?: string;
    conclusion?: string | null;
    html_url?: string | null;
    head_branch?: string | null;
    head_sha?: string | null;
    event?: string | null;
    run_attempt?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
};

type GitHubWorkflowJobsResponse = {
  jobs?: Array<{
    id: number;
    name?: string;
    status?: string;
    conclusion?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
};

export async function fetchGitHubPullRequestArtifactPacket(
  ref: GitHubPrRef,
  options: GitHubPrArtifactFetchOptions = {}
): Promise<PullRequestArtifactFetchResult> {
  const parsed = GitHubPrRefSchema.parse(ref);
  const fetchImpl = options.fetchImpl ?? fetch;
  const warnings: string[] = [];
  const githubToken = resolveGitHubToken(options.githubToken);
  const mode = options.mode ?? "standard";

  if (options.preferRecordedSnapshot === true) {
    const fallback = await loadRecordedPullRequestArtifactPacket(parsed, options.rootDir);
    if (fallback) {
      warnings.push("Live GitHub fetch skipped after rate-limit signal; using recorded public PR snapshot fallback.");
      return { source: "recorded_snapshot_fallback", packet: fallback, warnings };
    }
  }

  try {
    const packet = await fetchLivePacket(parsed, fetchImpl, githubToken, mode);
    return { source: "live_github_api", packet, warnings };
  } catch (error) {
    const fallback = await loadRecordedPullRequestArtifactPacket(parsed, options.rootDir);
    if (!fallback) throw error;
    warnings.push(formatAdapterWarning(error));
    if (!githubToken && isRateLimitWarning(error)) {
      warnings.push("No GitHub token configured; set STAX_GITHUB_TOKEN or GITHUB_TOKEN for higher GitHub API limits.");
    }
    warnings.push("Using recorded public PR snapshot fallback.");
    return { source: "recorded_snapshot_fallback", packet: fallback, warnings };
  }
}

export async function loadRecordedPullRequestArtifactPacket(
  ref: GitHubPrRef,
  rootDir = process.cwd()
): Promise<PullRequestArtifactPacket | undefined> {
  const fixturePath = path.join(rootDir, "fixtures", "pr_artifact_trial", "pr_artifact_trial_50_cases.json");
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf8")) as unknown;
  const fixture = RecordedSnapshotFixtureSchema.parse(raw);
  const match = fixture.snapshots.find(
    (snapshot) => snapshot.repoFullName === ref.repoFullName && snapshot.packet.prNumber === ref.prNumber
  );
  return match?.packet;
}

async function fetchLivePacket(
  ref: GitHubPrRef,
  fetchImpl: FetchLike,
  githubToken: string | undefined,
  mode: "standard" | "live_trial"
): Promise<PullRequestArtifactPacket> {
  const headers = buildHeaders(githubToken);
  const pull = await fetchJson<GitHubPullResponse>(
    fetchImpl,
    `https://api.github.com/repos/${ref.repoFullName}/pulls/${ref.prNumber}`,
    headers
  );
  const files = await fetchPaginatedJson<GitHubPullFileResponse>(
    fetchImpl,
    `https://api.github.com/repos/${ref.repoFullName}/pulls/${ref.prNumber}/files?per_page=100`,
    headers
  );
  const reviewComments = await fetchPaginatedJson<GitHubReviewCommentResponse>(
    fetchImpl,
    `https://api.github.com/repos/${ref.repoFullName}/pulls/${ref.prNumber}/comments?per_page=100`,
    headers
  ).catch(() => []);
  const issueLinks = extractIssueLinks(pull.body ?? "");
  const unifiedDiff = await fetchPatch(fetchImpl, ref);
  const workflowRunPageSize = mode === "live_trial" ? 5 : 20;
  const workflowRuns = pull.head?.sha
    ? await fetchJson<GitHubWorkflowRunsResponse>(
        fetchImpl,
        `https://api.github.com/repos/${ref.repoFullName}/actions/runs?head_sha=${pull.head.sha}&event=pull_request&per_page=${workflowRunPageSize}`,
        headers
      ).catch(() => ({ workflow_runs: [] }))
    : { workflow_runs: [] };
  const workflowRunStatuses = pull.head?.sha
    ? await buildWorkflowRunStatuses({
        fetchImpl,
        headers,
        repoFullName: ref.repoFullName,
        runs: workflowRuns.workflow_runs ?? [],
        branch: pull.head.ref,
        commitSha: pull.head.sha,
        includeJobDetails: mode !== "live_trial"
      })
    : [];
  const checkRuns =
    workflowRunStatuses.length === 0 && pull.head?.sha
      ? await fetchJson<GitHubCheckRunsResponse>(
          fetchImpl,
          `https://api.github.com/repos/${ref.repoFullName}/commits/${pull.head.sha}/check-runs`,
          headers
        ).catch(() => ({ check_runs: [] }))
      : { check_runs: [] };
  const ciStatuses = workflowRunStatuses.length > 0
    ? workflowRunStatuses
    : (checkRuns.check_runs ?? []).map((checkRun) => {
        const status = normalizeCheckRunStatus(checkRun.status, checkRun.conclusion);
        return {
          workflow: checkRun.name ?? "check-run",
          provider: "github_checks" as const,
          jobName: checkRun.name ?? undefined,
          status,
          branch: pull.head?.ref,
          commitSha: checkRun.head_sha ?? pull.head?.sha,
          startedAt: checkRun.started_at ?? undefined,
          finishedAt: checkRun.completed_at ?? undefined,
          runUrl: checkRun.details_url ?? undefined,
          summary: [checkRun.output?.title, checkRun.output?.summary, checkRun.details_url].filter(Boolean).join(" | ") || status,
          failedJobCount: status === "failure" ? 1 : 0,
          cancelledJobCount: status === "cancelled" ? 1 : 0,
          skippedJobCount: status === "skipped" ? 1 : 0
        };
      });

  return PullRequestArtifactPacketSchema.parse({
    prNumber: pull.number,
    title: pull.title,
    body: pull.body ?? "",
    repo: ref.repoFullName,
    branch: pull.head?.ref,
    baseBranch: pull.base?.ref,
    commitSha: pull.head?.sha,
    changedFiles: files.map((file) => file.filename),
    unifiedDiff,
    ciStatuses,
    reviewComments: reviewComments.map((comment) => ({
      author: comment.user?.login,
      path: comment.path,
      body: comment.body ?? "Review comment body unavailable.",
      state: "unknown"
    })),
    issueLinks,
    labels: (pull.labels ?? []).map((label) => label.name).filter(Boolean)
  });
}

async function buildWorkflowRunStatuses(
  args: {
    fetchImpl: FetchLike;
    headers: Record<string, string>;
    repoFullName: string;
    runs: NonNullable<GitHubWorkflowRunsResponse["workflow_runs"]>;
    branch: string | undefined;
    commitSha: string | undefined;
    includeJobDetails: boolean;
  }
): Promise<Array<PullRequestArtifactPacket["ciStatuses"][number]>> {
  const statuses: Array<PullRequestArtifactPacket["ciStatuses"][number]> = [];
  for (const run of args.runs) {
    const jobs =
      args.includeJobDetails === true
        ? await fetchJson<GitHubWorkflowJobsResponse>(
            args.fetchImpl,
            `https://api.github.com/repos/${args.repoFullName}/actions/runs/${run.id}/jobs?per_page=100`,
            args.headers
          ).catch(() => ({ jobs: [] }))
        : { jobs: [] };
    const jobItems = jobs.jobs ?? [];
    const completedJobCount = jobItems.filter((job) => job.status === "completed" && job.conclusion === "success").length;
    const failedJobCount = jobItems.filter((job) => job.conclusion === "failure" || job.conclusion === "timed_out" || job.conclusion === "action_required").length;
    const cancelledJobCount = jobItems.filter((job) => job.conclusion === "cancelled").length;
    const skippedJobCount = jobItems.filter((job) => job.conclusion === "skipped").length;
    const status = normalizeCheckRunStatus(run.status, run.conclusion);
    const failingJobNames = jobItems
      .filter((job) => job.conclusion === "failure" || job.conclusion === "timed_out" || job.conclusion === "action_required")
      .slice(0, 3)
      .map((job) => job.name)
      .filter(Boolean);
    statuses.push({
      workflow: run.name ?? `workflow-${run.id}`,
      provider: "github_actions",
      status,
      branch: run.head_branch ?? args.branch,
      commitSha: run.head_sha ?? args.commitSha,
      startedAt: run.created_at ?? undefined,
      finishedAt: run.updated_at ?? undefined,
      runId: run.id,
      runUrl: run.html_url ?? undefined,
      attempt: run.run_attempt ?? undefined,
      eventName: run.event ?? undefined,
      expectedJobCount: jobItems.length || undefined,
      completedJobCount,
      failedJobCount,
      cancelledJobCount,
      skippedJobCount,
      summary: [
        `${jobItems.length} job(s)`,
        failingJobNames.length > 0 ? `failing: ${failingJobNames.join(", ")}` : undefined,
        run.html_url ?? undefined
      ].filter(Boolean).join(" | "),
      log: jobItems
        .map((job) => `${job.name ?? "job"}: ${job.conclusion ?? job.status ?? "unknown"}`)
        .join("\n") || undefined
    });
  }
  return statuses;
}

async function fetchPatch(fetchImpl: FetchLike, ref: GitHubPrRef): Promise<string | undefined> {
  const response = await fetchImpl(`https://patch-diff.githubusercontent.com/raw/${ref.repoFullName}/pull/${ref.prNumber}.patch`, {
    headers: { "User-Agent": "Codex-STAX" }
  });
  if (!response.ok) return undefined;
  const text = await response.text();
  return text.trim() ? text : undefined;
}

async function fetchJson<T>(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw formatGitHubApiError(url, response);
  }
  return (await response.json()) as T;
}

async function fetchPaginatedJson<T>(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const response = await fetchImpl(nextUrl, { headers });
    if (!response.ok) {
      throw formatGitHubApiError(nextUrl, response);
    }
    const page = (await response.json()) as T[];
    items.push(...page);
    nextUrl = parseNextLink(response.headers.get("link"));
  }
  return items;
}

function buildHeaders(githubToken?: string): Record<string, string> {
  const token = resolveGitHubToken(githubToken);
  const headers: Record<string, string> = {
    "User-Agent": "Codex-STAX",
    Accept: "application/vnd.github+json"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseNextLink(linkHeader: string | null): string | undefined {
  if (!linkHeader) return undefined;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return undefined;
}

function normalizeCheckRunStatus(status?: string, conclusion?: string | null): PullRequestArtifactPacket["ciStatuses"][number]["status"] {
  if (status === "completed") {
    if (conclusion === "success" || conclusion === "neutral") return "success";
    if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "action_required") return "failure";
    if (conclusion === "cancelled") return "cancelled";
    if (conclusion === "skipped") return "skipped";
    return "unknown";
  }
  if (status === "queued" || status === "in_progress" || status === "requested" || status === "waiting") return "pending";
  return "unknown";
}

function extractIssueLinks(body: string): Array<{ issueId: string; title?: string; status: "open" | "closed" | "unknown" }> {
  const matches = Array.from(body.matchAll(/#(\d+)/g));
  return Array.from(new Set(matches.map((match) => match[1]))).map((issueId) => ({
    issueId,
    status: "unknown"
  }));
}

function formatAdapterWarning(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolveGitHubToken(githubToken?: string): string | undefined {
  return githubToken ?? process.env.STAX_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
}

function isRateLimitWarning(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rate limit/i.test(message);
}

function formatGitHubApiError(url: string, response: Response): Error {
  const base = `GitHub API request failed: ${response.status} ${response.statusText} for ${url}`;
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");
  const rateLimitResource = response.headers.get("x-ratelimit-resource");
  const retryAfter = response.headers.get("retry-after");
  const likelyRateLimited = response.status === 429 || (response.status === 403 && rateLimitRemaining === "0");
  if (!likelyRateLimited) return new Error(base);
  const details: string[] = [];
  if (rateLimitResource) details.push(`resource=${rateLimitResource}`);
  if (rateLimitReset) {
    const resetUnix = Number(rateLimitReset);
    if (Number.isFinite(resetUnix) && resetUnix > 0) {
      details.push(`reset_at=${new Date(resetUnix * 1000).toISOString()}`);
    } else {
      details.push(`reset=${rateLimitReset}`);
    }
  }
  if (retryAfter) details.push(`retry_after_s=${retryAfter}`);
  const suffix = details.length ? ` (${details.join(", ")})` : "";
  return new Error(`${base}; rate limit exceeded${suffix}`);
}
