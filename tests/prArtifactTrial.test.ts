import { describe, expect, it } from "vitest";
import { scorePrArtifactTrial, validatePrArtifactTrialFixtures } from "../src/campaign/PrArtifactTrial.js";

describe("PR artifact trial", () => {
  it("validates the real PR artifact fixture set", async () => {
    const summary = await validatePrArtifactTrialFixtures(process.cwd());

    expect(summary.snapshotCount).toBe(10);
    expect(summary.caseCount).toBe(50);
    expect(summary.categoryCounts.passing_ci).toBe(10);
    expect(summary.categoryCounts.failing_ci).toBe(10);
    expect(summary.categoryCounts.docs_config_only).toBe(10);
    expect(summary.categoryCounts.tests_fixtures_goldens).toBe(10);
    expect(summary.categoryCounts.ui_data_deploy_security).toBe(10);
    expect(summary.status).toBe("passed");
  });

  it("scores the real PR artifact trial without false accepts", async () => {
    const summary = await scorePrArtifactTrial(process.cwd());

    expect(summary.caseCount).toBe(50);
    expect(summary.falseAccepts).toBe(0);
    expect(summary.falseBlockRatePct).toBeLessThanOrEqual(15);
    expect(summary.usefulNextActionRate).toBeGreaterThanOrEqual(85);
    expect(summary.ciProofClassificationAccuracy).toBeGreaterThanOrEqual(90);
    expect(summary.status).toBe("passed");
  });
});
