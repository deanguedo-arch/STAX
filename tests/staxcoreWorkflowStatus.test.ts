import { describe, expect, it } from "vitest";
import { fetchStaxcoreWorkflowStatus } from "../src/campaign/StaxcoreWorkflowStatus.js";

describe("staxcore workflow status", () => {
  it("returns latest runs on successful response", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          workflow_runs: [
            {
              id: 101,
              head_sha: "abc123",
              status: "completed",
              conclusion: "success",
              event: "push",
              created_at: "2026-05-04T01:00:00Z",
              html_url: "https://github.com/example/repo/actions/runs/101"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "x-ratelimit-limit": "60",
            "x-ratelimit-remaining": "59",
            "x-ratelimit-reset": "1777859400"
          }
        }
      );

    const result = await fetchStaxcoreWorkflowStatus({
      repoFullName: "deanguedo-arch/STAX",
      workflowId: "staxcore-strict.yml",
      perPage: 3,
      githubToken: "test-token",
      fetchImpl
    });

    expect(result.status).toBe("ok");
    expect(result.usedAuth).toBe(true);
    expect(result.runs).toHaveLength(1);
    expect(result.latestRun?.id).toBe(101);
    expect(result.latestRun?.conclusion).toBe("success");
  });

  it("returns rate_limited when GitHub responds with core limit exhaustion", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        statusText: "Forbidden",
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1777859400"
        }
      });

    const result = await fetchStaxcoreWorkflowStatus({
      fetchImpl,
      githubToken: undefined
    });

    expect(result.status).toBe("rate_limited");
    expect(result.rateLimit.remaining).toBe(0);
    expect(result.message).toContain("retry after");
  });

  it("returns request_failed on non-rate-limit API errors", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "58"
        }
      });

    const result = await fetchStaxcoreWorkflowStatus({ fetchImpl });

    expect(result.status).toBe("request_failed");
    expect(result.message).toContain("500");
    expect(result.runs).toHaveLength(0);
  });
});
