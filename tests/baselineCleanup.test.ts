import { describe, expect, it } from "vitest";
import { summarizeBaselineCleanup } from "../src/campaign/BaselineCleanup.js";

describe("summarizeBaselineCleanup", () => {
  it("marks a measured five-task baseline ready", () => {
    const summary = summarizeBaselineCleanup({
      campaignId: "baseline",
      tasks: [2, 4, 6, 8, 10].map((cleanup, index) => ({
        taskId: `baseline_${index + 1}`,
        repo: "STAX",
        cleanupPromptsAfterCodex: cleanup
      }))
    });

    expect(summary.status).toBe("baseline_ready");
    expect(summary.meanCleanupPrompts).toBe(6);
    expect(summary.medianCleanupPrompts).toBe(6);
  });

  it("blocks when cleanup counts are still unknown", () => {
    const summary = summarizeBaselineCleanup({
      campaignId: "baseline",
      tasks: Array.from({ length: 5 }, (_, index) => ({
        taskId: `baseline_${index + 1}`,
        repo: "ADMISSION-APP",
        cleanupPromptsAfterCodex: index < 2 ? index + 1 : null
      }))
    });

    expect(summary.status).toBe("baseline_incomplete");
    expect(summary.blockers).toContain("fewer than 5 baseline tasks have measured cleanup prompt counts");
  });
});
