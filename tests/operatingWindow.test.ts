import { describe, expect, it } from "vitest";
import { summarizeOperatingWindow } from "../src/campaign/OperatingWindow.js";

describe("summarizeOperatingWindow", () => {
  it("passes when the full 30-task window meets thresholds", () => {
    const summary = summarizeOperatingWindow({
      ledger: {
        campaignId: "window",
        tasks: Array.from({ length: 30 }, (_, index) => ({
          taskId: `task_${index + 1}`,
          repo: ["STAX", "ADMISSION-APP", "canvas-helper"][index % 3]!,
          cleanupPromptsAfterCodex: 2,
          staxInitialPromptUseful: true,
          humanDecision: "accepted",
          fakeCompleteCaught: index < 10,
          missingProofCaught: true,
          wrongRepoPrevented: false,
          staxCriticalMiss: false,
          evalCandidate: true
        }))
      },
      baselineLedger: {
        campaignId: "baseline",
        tasks: Array.from({ length: 5 }, (_, index) => ({
          taskId: `baseline_${index + 1}`,
          repo: "STAX",
          cleanupPromptsAfterCodex: 5
        }))
      }
    });

    expect(summary.status).toBe("operating_window_passed");
    expect(summary.cleanupReductionPct).toBe(60);
  });

  it("blocks when fewer than 30 tasks are present", () => {
    const summary = summarizeOperatingWindow({
      ledger: {
        campaignId: "window",
        tasks: []
      }
    });

    expect(summary.status).toBe("invalid");
  });
});
