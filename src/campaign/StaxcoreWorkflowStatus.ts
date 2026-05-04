type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type StaxcoreWorkflowStatusOptions = {
  repoFullName?: string;
  workflowId?: string;
  perPage?: number;
  githubToken?: string;
  fetchImpl?: FetchLike;
};

export type StaxcoreWorkflowRun = {
  id: number;
  headSha: string;
  status: string;
  conclusion: string | null;
  event: string;
  createdAt: string;
  htmlUrl: string;
};

export type StaxcoreWorkflowStatusResult = {
  status: "ok" | "rate_limited" | "request_failed";
  checkedAt: string;
  repoFullName: string;
  workflowId: string;
  requestedPerPage: number;
  usedAuth: boolean;
  rateLimit: {
    limit: number | null;
    remaining: number | null;
    resetAt: string | null;
  };
  latestRun: StaxcoreWorkflowRun | null;
  runs: StaxcoreWorkflowRun[];
  message?: string;
};

const DEFAULT_REPO = "deanguedo-arch/STAX";
const DEFAULT_WORKFLOW_ID = "staxcore-strict.yml";
const DEFAULT_PER_PAGE = 5;

type GitHubWorkflowRunResponse = {
  workflow_runs?: Array<{
    id?: number;
    head_sha?: string;
    status?: string;
    conclusion?: string | null;
    event?: string;
    created_at?: string;
    html_url?: string;
  }>;
};

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function toIsoFromUnixSeconds(value: string | null): string | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed * 1000).toISOString();
}

function resolveGitHubToken(override?: string): string | undefined {
  const direct = override?.trim();
  if (direct) return direct;
  const staxToken = process.env.STAX_GITHUB_TOKEN?.trim();
  if (staxToken) return staxToken;
  const githubToken = process.env.GITHUB_TOKEN?.trim();
  if (githubToken) return githubToken;
  return undefined;
}

function buildHeaders(githubToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Codex-STAX"
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  return headers;
}

function extractRateLimit(response: Response): StaxcoreWorkflowStatusResult["rateLimit"] {
  return {
    limit: parsePositiveInt(response.headers.get("x-ratelimit-limit")),
    remaining: parsePositiveInt(response.headers.get("x-ratelimit-remaining")),
    resetAt: toIsoFromUnixSeconds(response.headers.get("x-ratelimit-reset"))
  };
}

function isRateLimited(response: Response, bodyText: string): boolean {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  const remaining = parsePositiveInt(response.headers.get("x-ratelimit-remaining"));
  if (remaining === 0) return true;
  return /rate limit/i.test(bodyText);
}

function parseRuns(raw: unknown): StaxcoreWorkflowRun[] {
  const payload = raw as GitHubWorkflowRunResponse;
  if (!Array.isArray(payload.workflow_runs)) return [];
  const runs: StaxcoreWorkflowRun[] = [];
  for (const candidate of payload.workflow_runs) {
    if (typeof candidate?.id !== "number") continue;
    if (typeof candidate?.head_sha !== "string") continue;
    if (typeof candidate?.status !== "string") continue;
    if (typeof candidate?.event !== "string") continue;
    if (typeof candidate?.created_at !== "string") continue;
    if (typeof candidate?.html_url !== "string") continue;
    runs.push({
      id: candidate.id,
      headSha: candidate.head_sha,
      status: candidate.status,
      conclusion: typeof candidate.conclusion === "string" ? candidate.conclusion : null,
      event: candidate.event,
      createdAt: candidate.created_at,
      htmlUrl: candidate.html_url
    });
  }
  return runs;
}

export async function fetchStaxcoreWorkflowStatus(
  options: StaxcoreWorkflowStatusOptions = {}
): Promise<StaxcoreWorkflowStatusResult> {
  const repoFullName = options.repoFullName?.trim() || DEFAULT_REPO;
  const workflowId = options.workflowId?.trim() || DEFAULT_WORKFLOW_ID;
  const perPage =
    Number.isFinite(options.perPage) && (options.perPage ?? 0) > 0 ? Math.trunc(options.perPage as number) : DEFAULT_PER_PAGE;
  const githubToken = resolveGitHubToken(options.githubToken);
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `https://api.github.com/repos/${repoFullName}/actions/workflows/${workflowId}/runs?per_page=${perPage}`;
  const headers = buildHeaders(githubToken);

  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "request_failed",
      checkedAt: new Date().toISOString(),
      repoFullName,
      workflowId,
      requestedPerPage: perPage,
      usedAuth: Boolean(githubToken),
      rateLimit: { limit: null, remaining: null, resetAt: null },
      latestRun: null,
      runs: [],
      message: `GitHub request failed before response: ${message}`
    };
  }

  const rateLimit = extractRateLimit(response);
  const bodyText = await response.text();
  const checkedAt = new Date().toISOString();

  if (!response.ok) {
    if (isRateLimited(response, bodyText)) {
      return {
        status: "rate_limited",
        checkedAt,
        repoFullName,
        workflowId,
        requestedPerPage: perPage,
        usedAuth: Boolean(githubToken),
        rateLimit,
        latestRun: null,
        runs: [],
        message:
          rateLimit.resetAt !== null
            ? `GitHub API rate limit exceeded; retry after ${rateLimit.resetAt}.`
            : "GitHub API rate limit exceeded."
      };
    }
    return {
      status: "request_failed",
      checkedAt,
      repoFullName,
      workflowId,
      requestedPerPage: perPage,
      usedAuth: Boolean(githubToken),
      rateLimit,
      latestRun: null,
      runs: [],
      message: `GitHub API request failed: ${response.status} ${response.statusText}`
    };
  }

  let parsed: unknown;
  try {
    parsed = bodyText.trim() ? JSON.parse(bodyText) : {};
  } catch {
    return {
      status: "request_failed",
      checkedAt,
      repoFullName,
      workflowId,
      requestedPerPage: perPage,
      usedAuth: Boolean(githubToken),
      rateLimit,
      latestRun: null,
      runs: [],
      message: "GitHub API returned non-JSON workflow payload."
    };
  }

  const runs = parseRuns(parsed);
  return {
    status: "ok",
    checkedAt,
    repoFullName,
    workflowId,
    requestedPerPage: perPage,
    usedAuth: Boolean(githubToken),
    rateLimit,
    latestRun: runs[0] ?? null,
    runs
  };
}
