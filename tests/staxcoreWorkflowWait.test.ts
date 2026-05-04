import { describe, expect, it } from "vitest";
import { waitForStaxcoreWorkflow } from "../src/campaign/StaxcoreWorkflowWait.js";
import type { StaxcoreWorkflowStatusResult } from "../src/campaign/StaxcoreWorkflowStatus.js";

function mkStatus(input: Partial<StaxcoreWorkflowStatusResult>): StaxcoreWorkflowStatusResult {
  return {
    status: "ok",
    checkedAt: "2026-05-04T01:00:00.000Z",
    repoFullName: "deanguedo-arch/STAX",
    workflowId: "staxcore-strict.yml",
    requestedPerPage: 1,
    usedAuth: false,
    rateLimit: { limit: 60, remaining: 59, resetAt: "2026-05-04T02:00:00.000Z" },
    latestRun: null,
    runs: [],
    ...input
  };
}

describe("waitForStaxcoreWorkflow", () => {
  it("returns success when run completes with success", async () => {
    const responses = [
      mkStatus({
        latestRun: {
          id: 1,
          headSha: "abc",
          status: "in_progress",
          conclusion: null,
          event: "push",
          createdAt: "2026-05-04T01:00:00Z",
          htmlUrl: "https://example.test/run/1"
        },
        runs: []
      }),
      mkStatus({
        latestRun: {
          id: 1,
          headSha: "abc",
          status: "completed",
          conclusion: "success",
          event: "push",
          createdAt: "2026-05-04T01:00:00Z",
          htmlUrl: "https://example.test/run/1"
        },
        runs: []
      })
    ];
    let index = 0;

    const result = await waitForStaxcoreWorkflow({
      timeoutMs: 1000,
      intervalMs: 1,
      fetchStatus: async () => responses[Math.min(index++, responses.length - 1)] as StaxcoreWorkflowStatusResult,
      sleepImpl: async () => undefined
    });

    expect(result.status).toBe("success");
    expect(result.polls.length).toBeGreaterThanOrEqual(2);
  });

  it("returns failed when run completes without success", async () => {
    const result = await waitForStaxcoreWorkflow({
      timeoutMs: 1000,
      intervalMs: 1,
      fetchStatus: async () =>
        mkStatus({
          latestRun: {
            id: 2,
            headSha: "def",
            status: "completed",
            conclusion: "failure",
            event: "push",
            createdAt: "2026-05-04T01:00:00Z",
            htmlUrl: "https://example.test/run/2"
          }
        }),
      sleepImpl: async () => undefined
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("failure");
  });

  it("times out when run never completes", async () => {
    const result = await waitForStaxcoreWorkflow({
      timeoutMs: 1,
      intervalMs: 1,
      fetchStatus: async () =>
        mkStatus({
          latestRun: {
            id: 3,
            headSha: "ghi",
            status: "in_progress",
            conclusion: null,
            event: "push",
            createdAt: "2026-05-04T01:00:00Z",
            htmlUrl: "https://example.test/run/3"
          }
        }),
      sleepImpl: async () => undefined
    });

    expect(result.status).toBe("timed_out");
  });
});
