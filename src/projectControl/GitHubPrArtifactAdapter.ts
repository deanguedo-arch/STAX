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

export async function fetchGitHubPullRequestArtifactPacket(
  ref: GitHubPrRef,
  options: {
    rootDir?: string;
    fetchImpl?: FetchLike;
    githubToken?: string;
  } = {}
): Promise<PullRequestArtifactFetchResult> {
  const parsed = GitHubPrRefSchema.parse(ref);
  const fetchImpl = options.fetchImpl ?? fetch;
  const warnings: string[] = [];

  try {
    const packet = await fetchLivePacket(parsed, fetchImpl, options.githubToken);
    return { source: "live_github_api", packet, warnings };
  } catch (error) {
    const fallback = await loadRecordedPullRequestArtifactPacket(parsed, options.rootDir);
    if (!fallback) throw error;
    warnings.push(formatAdapterWarning(error));
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
  githubToken?: string
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
  const checkRuns = pull.head?.sha
    ? await fetchJson<GitHubCheckRunsResponse>(
        fetchImpl,
        `https://api.github.com/repos/${ref.repoFullName}/commits/${pull.head.sha}/check-runs`,
        headers
      ).catch(() => ({ check_runs: [] }))
    : { check_runs: [] };

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
    ciStatuses: (checkRuns.check_runs ?? []).map((checkRun) => {
      const status = normalizeCheckRunStatus(checkRun.status, checkRun.conclusion);
      return {
        workflow: checkRun.name ?? "check-run",
        jobName: checkRun.name ?? undefined,
        status,
        branch: pull.head?.ref,
        commitSha: checkRun.head_sha ?? pull.head?.sha,
        startedAt: checkRun.started_at ?? undefined,
        finishedAt: checkRun.completed_at ?? undefined,
        summary: [checkRun.output?.title, checkRun.output?.summary, checkRun.details_url].filter(Boolean).join(" | ") || status,
        failedJobCount: status === "failure" ? 1 : 0,
        cancelledJobCount: status === "cancelled" ? 1 : 0,
        skippedJobCount: status === "skipped" ? 1 : 0
      };
    }),
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
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchPaginatedJson<T>(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const response = await fetchImpl(nextUrl, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} for ${nextUrl}`);
    }
    const page = (await response.json()) as T[];
    items.push(...page);
    nextUrl = parseNextLink(response.headers.get("link"));
  }
  return items;
}

function buildHeaders(githubToken?: string): Record<string, string> {
  const token = githubToken ?? process.env.STAX_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
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
