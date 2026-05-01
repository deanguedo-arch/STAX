import { describe, expect, it } from "vitest";
import { summarizeFailureLedger } from "../src/campaign/FailureLedger.js";

describe("summarizeFailureLedger", () => {
  it("passes when every miss has a tracked failure entry", () => {
    const summary = summarizeFailureLedger({
      realUseLedger: {
        campaignId: "dogfood",
        tasks: [
          {
            taskId: "real_codex_001",
            repo: "STAX",
            staxInitialPromptUseful: false,
            humanDecision: "accepted_after_patch",
            staxCriticalMiss: false
          },
          {
            taskId: "real_codex_002",
            repo: "STAX",
            staxInitialPromptUseful: true,
            humanDecision: "accepted",
            staxCriticalMiss: false
          }
        ]
      },
      ledger: {
        campaignId: "failures",
        entries: [
          {
            failureId: "fail_001",
            sourceTaskId: "real_codex_001",
            failureType: "generic_next_action",
            severity: "major",
            expectedBehavior: "bounded",
            actualBehavior: "generic",
            patchTarget: "tests/example.json",
            evalCandidate: true,
            status: "eval_created"
          }
        ]
      }
    });

    expect(summary.status).toBe("tracked");
    expect(summary.missingSourceTaskIds).toHaveLength(0);
  });

  it("blocks when a miss lacks a failure record", () => {
    const summary = summarizeFailureLedger({
      realUseLedger: {
        campaignId: "dogfood",
        tasks: [
          {
            taskId: "real_codex_001",
            repo: "STAX",
            staxInitialPromptUseful: false,
            humanDecision: "accepted",
            staxCriticalMiss: false
          }
        ]
      },
      ledger: {
        campaignId: "failures",
        entries: []
      }
    });

    expect(summary.status).toBe("blocked");
    expect(summary.missingSourceTaskIds).toContain("real_codex_001");
  });
});
