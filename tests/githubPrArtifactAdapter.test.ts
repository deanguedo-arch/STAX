import { describe, expect, it } from "vitest";
import {
  fetchGitHubPullRequestArtifactPacket,
  loadRecordedPullRequestArtifactPacket
} from "../src/projectControl/GitHubPrArtifactAdapter.js";

describe("GitHub PR artifact adapter", () => {
  it("builds a live PR artifact packet from GitHub API responses", async () => {
    const responses = new Map<string, Response>([
      [
        "https://api.github.com/repos/example/repo/pulls/12",
        jsonResponse({
          number: 12,
          title: "Fix parser edge case",
          body: "Closes #44",
          head: { ref: "fix/parser-edge", sha: "abc1234" },
          base: { ref: "main" },
          labels: [{ name: "bug" }]
        })
      ],
      [
        "https://api.github.com/repos/example/repo/pulls/12/files?per_page=100",
        jsonResponse([{ filename: "src/parser.ts", patch: "@@ -1 +1 @@\n-old\n+new" }])
      ],
      [
        "https://api.github.com/repos/example/repo/pulls/12/comments?per_page=100",
        jsonResponse([{ user: { login: "reviewer" }, path: "src/parser.ts", body: "Please add a guard." }])
      ],
      [
        "https://api.github.com/repos/example/repo/commits/abc1234/check-runs",
        jsonResponse({
          check_runs: [
            {
              name: "test",
              status: "completed",
              conclusion: "success",
              head_sha: "abc1234",
              started_at: "2026-05-03T00:00:00Z",
              completed_at: "2026-05-03T00:05:00Z",
              details_url: "https://github.com/example/repo/actions/runs/1",
              output: { title: "Tests", summary: "All tests passed" }
            }
          ]
        })
      ],
      [
        "https://api.github.com/repos/example/repo/actions/runs?head_sha=abc1234&event=pull_request&per_page=20",
        jsonResponse({
          workflow_runs: [
            {
              id: 77,
              name: "CI",
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/example/repo/actions/runs/77",
              head_branch: "fix/parser-edge",
              head_sha: "abc1234",
              event: "pull_request",
              run_attempt: 2,
              created_at: "2026-05-03T00:00:00Z",
              updated_at: "2026-05-03T00:05:00Z"
            }
          ]
        })
      ],
      [
        "https://api.github.com/repos/example/repo/actions/runs/77/jobs?per_page=100",
        jsonResponse({
          jobs: [
            {
              id: 1,
              name: "unit",
              status: "completed",
              conclusion: "success",
              started_at: "2026-05-03T00:00:00Z",
              completed_at: "2026-05-03T00:02:00Z"
            },
            {
              id: 2,
              name: "lint",
              status: "completed",
              conclusion: "success",
              started_at: "2026-05-03T00:00:00Z",
              completed_at: "2026-05-03T00:03:00Z"
            }
          ]
        })
      ],
      [
        "https://patch-diff.githubusercontent.com/raw/example/repo/pull/12.patch",
        textResponse("diff --git a/src/parser.ts b/src/parser.ts\n--- a/src/parser.ts\n+++ b/src/parser.ts\n@@ -1 +1 @@\n-old\n+new")
      ]
    ]);

    const result = await fetchGitHubPullRequestArtifactPacket(
      { repoFullName: "example/repo", prNumber: 12 },
      { fetchImpl: mockFetch(responses) }
    );

    expect(result.source).toBe("live_github_api");
    expect(result.packet.prNumber).toBe(12);
    expect(result.packet.branch).toBe("fix/parser-edge");
    expect(result.packet.changedFiles).toEqual(["src/parser.ts"]);
    expect(result.packet.ciStatuses[0]?.status).toBe("success");
    expect(result.packet.ciStatuses[0]?.provider).toBe("github_actions");
    expect(result.packet.ciStatuses[0]?.expectedJobCount).toBe(2);
    expect(result.packet.ciStatuses[0]?.attempt).toBe(2);
    expect(result.packet.reviewComments[0]?.author).toBe("reviewer");
    expect(result.packet.issueLinks[0]?.issueId).toBe("44");
    expect(result.packet.unifiedDiff).toContain("diff --git");
  });

  it("falls back to a recorded snapshot when live GitHub fetch fails", async () => {
    const result = await fetchGitHubPullRequestArtifactPacket(
      { repoFullName: "vercel/next.js", prNumber: 93417 },
      {
        rootDir: process.cwd(),
        githubToken: "",
        fetchImpl: async () => {
          throw new Error("rate limit");
        }
      }
    );

    expect(result.source).toBe("recorded_snapshot_fallback");
    expect(result.packet.prNumber).toBe(93417);
    expect(result.warnings.join("\n")).toContain("rate limit");
    expect(result.warnings.join("\n")).toContain("No GitHub token configured");
  });

  it("surfaces rate-limit reset context when GitHub headers are present", async () => {
    const result = await fetchGitHubPullRequestArtifactPacket(
      { repoFullName: "vercel/next.js", prNumber: 93417 },
      {
        rootDir: process.cwd(),
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              message: "API rate limit exceeded"
            }),
            {
              status: 403,
              statusText: "Forbidden",
              headers: {
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": "1770000000",
                "x-ratelimit-resource": "core",
                "retry-after": "120"
              }
            }
          )
      }
    );

    expect(result.source).toBe("recorded_snapshot_fallback");
    expect(result.warnings.join("\n")).toContain("rate limit exceeded");
    expect(result.warnings.join("\n")).toContain("reset_at=");
    expect(result.warnings.join("\n")).toContain("retry_after_s=120");
  });

  it("loads recorded snapshots directly from the PR artifact trial fixture", async () => {
    const packet = await loadRecordedPullRequestArtifactPacket(
      { repoFullName: "vitest-dev/vitest", prNumber: 10231 },
      process.cwd()
    );

    expect(packet?.prNumber).toBe(10231);
    expect(packet?.changedFiles).toContain("packages/browser/src/client/tester/rpc.ts");
  });

  it("can force recorded snapshot usage without calling the live API", async () => {
    const result = await fetchGitHubPullRequestArtifactPacket(
      { repoFullName: "vercel/next.js", prNumber: 93417 },
      {
        rootDir: process.cwd(),
        preferRecordedSnapshot: true,
        fetchImpl: async () => {
          throw new Error("live fetch should not run");
        }
      }
    );

    expect(result.source).toBe("recorded_snapshot_fallback");
    expect(result.packet.prNumber).toBe(93417);
    expect(result.warnings.join("\n")).toContain("Live GitHub fetch skipped");
  });

  it("uses lightweight CI collection in live-trial mode", async () => {
    const responses = new Map<string, Response>([
      [
        "https://api.github.com/repos/example/repo/pulls/12",
        jsonResponse({
          number: 12,
          title: "Fix parser edge case",
          body: "Closes #44",
          head: { ref: "fix/parser-edge", sha: "abc1234" },
          base: { ref: "main" },
          labels: [{ name: "bug" }]
        })
      ],
      [
        "https://api.github.com/repos/example/repo/pulls/12/files?per_page=100",
        jsonResponse([{ filename: "src/parser.ts", patch: "@@ -1 +1 @@\n-old\n+new" }])
      ],
      [
        "https://api.github.com/repos/example/repo/pulls/12/comments?per_page=100",
        jsonResponse([{ user: { login: "reviewer" }, path: "src/parser.ts", body: "Please add a guard." }])
      ],
      [
        "https://api.github.com/repos/example/repo/actions/runs?head_sha=abc1234&event=pull_request&per_page=5",
        jsonResponse({
          workflow_runs: [
            {
              id: 77,
              name: "CI",
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/example/repo/actions/runs/77",
              head_branch: "fix/parser-edge",
              head_sha: "abc1234",
              event: "pull_request",
              run_attempt: 1,
              created_at: "2026-05-03T00:00:00Z",
              updated_at: "2026-05-03T00:05:00Z"
            }
          ]
        })
      ],
      [
        "https://patch-diff.githubusercontent.com/raw/example/repo/pull/12.patch",
        textResponse("diff --git a/src/parser.ts b/src/parser.ts\n--- a/src/parser.ts\n+++ b/src/parser.ts\n@@ -1 +1 @@\n-old\n+new")
      ]
    ]);

    const result = await fetchGitHubPullRequestArtifactPacket(
      { repoFullName: "example/repo", prNumber: 12 },
      { fetchImpl: mockFetch(responses), mode: "live_trial" }
    );

    expect(result.source).toBe("live_github_api");
    expect(result.packet.ciStatuses[0]?.provider).toBe("github_actions");
    expect(result.packet.ciStatuses[0]?.expectedJobCount).toBeUndefined();
  });
});

function mockFetch(responses: Map<string, Response>): typeof fetch {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    const response = responses.get(url);
    if (!response) throw new Error(`Unexpected fetch: ${url}`);
    return response;
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function textResponse(value: string): Response {
  return new Response(value, { status: 200 });
}
