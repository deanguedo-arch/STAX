import { describe, expect, it } from "vitest";
import { summarizeDogfoodRoundC } from "../src/campaign/DogfoodRoundC.js";

function task(index: number) {
  return {
    taskId: `dogfood_${index}`,
    repo: index % 2 === 0 ? "STAX" : "ADMISSION-APP",
    task: "Audit task",
    staxInitialPrompt: "prompt",
    staxInitialPromptUseful: true,
    codexReport: "report",
    staxAudit: "audit",
    fakeCompleteCaught: index <= 3,
    missingProofCaught: true,
    wrongRepoPrevented: false,
    cleanupPromptsAfterCodex: 2,
    finalOutcome: "verified_next_state",
    staxCriticalMiss: false,
    humanDecision: "accepted",
    evalCandidate: true
  };
}

describe("summarizeDogfoodRoundC", () => {
  it("passes when thresholds and baseline are met", () => {
    const summary = summarizeDogfoodRoundC({
      ledger: {
        campaignId: "round_c",
        tasks: Array.from({ length: 10 }, (_, index) => task(index + 1))
      },
      baselineLedger: {
        campaignId: "baseline",
        tasks: Array.from({ length: 5 }, (_, index) => ({
          taskId: `baseline_${index + 1}`,
          repo: "STAX",
          cleanupPromptsAfterCodex: 5
        }))
      },
      failureLedger: {
        campaignId: "failures",
        entries: []
      }
    });

    expect(summary.status).toBe("round_c_passed");
    expect(summary.cleanupReductionPct).toBe(60);
  });

  it("blocks when baseline is missing", () => {
    const summary = summarizeDogfoodRoundC({
      ledger: {
        campaignId: "round_c",
        tasks: Array.from({ length: 10 }, (_, index) => task(index + 1))
      }
    });

    expect(summary.status).toBe("round_c_blocked");
    expect(summary.blockers).toContain("baseline cleanup reduction cannot be computed yet");
  });
});
