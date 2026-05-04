import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeBaselineCleanup } from "../src/campaign/BaselineCleanup.js";
import { summarizeDogfoodRoundC } from "../src/campaign/DogfoodRoundC.js";
import { summarizeFailureLedger } from "../src/campaign/FailureLedger.js";
import { summarizeOperatingWindow } from "../src/campaign/OperatingWindow.js";
import { evaluatePromotionGate95 } from "../src/campaign/PromotionGate95.js";

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

  it("reports full live PR trial status when optional trial gates are disabled", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-promotion-gate-"));
    const configPath = path.join(tempDir, "promotion_gate_config.json");
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          requiredCleanRuns: 0,
          comparisonRunIds: [],
          requireCiFailureTriage: false,
          requirePrReviewCommentScore: false,
          requireLivePrArtifactTrial: false,
          requireLivePrArtifactTrialFull: false,
          requireLivePrArtifactTrialHard: false
        },
        null,
        2
      ),
      "utf8"
    );
    try {
      const summary = await evaluatePromotionGate95({ configPath });
      expect(summary.status).toBe("promotion_ready");
      expect(summary.livePrArtifactTrialStatus).toBe("not_required");
      expect(summary.livePrArtifactTrialFullStatus).toBe("not_required");
      expect(summary.livePrArtifactTrialHardStatus).toBe("not_required");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
