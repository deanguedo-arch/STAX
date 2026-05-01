import { describe, expect, it } from "vitest";
import { summarizeBaselineCleanup } from "../src/campaign/BaselineCleanup.js";
import { summarizeDogfoodRoundC } from "../src/campaign/DogfoodRoundC.js";
import { summarizeFailureLedger } from "../src/campaign/FailureLedger.js";
import { summarizeOperatingWindow } from "../src/campaign/OperatingWindow.js";

describe("9.5 campaign building blocks", () => {
  it("keeps the constituent summaries available for a promotion gate", () => {
    const baseline = summarizeBaselineCleanup({
      campaignId: "baseline",
      tasks: Array.from({ length: 5 }, (_, index) => ({
        taskId: `baseline_${index + 1}`,
        repo: "STAX",
        cleanupPromptsAfterCodex: 5
      }))
    });
    const failures = summarizeFailureLedger({
      realUseLedger: {
        campaignId: "dogfood",
        tasks: []
      },
      ledger: {
        campaignId: "failures",
        entries: []
      }
    });
    const dogfood = summarizeDogfoodRoundC({
      ledger: {
        campaignId: "round_c",
        tasks: []
      }
    });
    const window = summarizeOperatingWindow({
      ledger: {
        campaignId: "window",
        tasks: []
      }
    });

    expect(baseline.status).toBe("baseline_ready");
    expect(failures.status).toBe("invalid");
    expect(dogfood.status).toBe("invalid");
    expect(window.status).toBe("invalid");
  });
});
