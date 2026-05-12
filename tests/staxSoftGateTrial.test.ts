import { describe, expect, it } from "vitest";
import { buildDefaultSoftGateTrial, evaluateSoftGateTrial, renderSoftGateTrialReport } from "../src/sidecar/StaxSoftGateTrial.js";

describe("STAX soft-gate trial", () => {
  it("meets the controlled Phase 4 soft-gate thresholds", () => {
    const trial = buildDefaultSoftGateTrial("2026-05-12T12:00:00.000Z");
    const summary = evaluateSoftGateTrial(trial);

    expect(summary.status).toBe("passed");
    expect(summary.totalRuns).toBe(50);
    expect(summary.criticalFalseAccepts).toBe(0);
    expect(summary.buildTestTypecheckFalseRejectRate).toBeLessThanOrEqual(0.05);
    expect(summary.overrideRate).toBeLessThanOrEqual(0.2);
    expect(summary.nextPromptActionableRate).toBeGreaterThanOrEqual(0.9);
    expect(summary.unresolvedCiLocalMismatch).toBe(0);
    expect(summary.repoClassesCovered).toEqual([
      "brightspace_observer",
      "fixture_repo",
      "low_risk_real_repo",
      "messy_real_repo",
      "stax_repo"
    ]);
  });

  it("renders a soft-gate trial report with the activation boundary", () => {
    const summary = evaluateSoftGateTrial(buildDefaultSoftGateTrial("2026-05-12T12:00:00.000Z"));
    const rendered = renderSoftGateTrialReport(summary, "2026-05-12T12:00:00.000Z");

    expect(rendered).toContain("# STAX Soft-Gate Trial Report");
    expect(rendered).toContain("Status: passed");
    expect(rendered).toContain("It does not activate hard gate");
  });

  it("fails the trial when a high-risk false accept appears", () => {
    const trial = buildDefaultSoftGateTrial("2026-05-12T12:00:00.000Z");
    trial.runs[0] = {
      ...trial.runs[0],
      highRisk: true,
      falseAccept: true,
      actualVerdict: "Accept",
      expectedVerdict: "Reject"
    };

    const summary = evaluateSoftGateTrial(trial);

    expect(summary.status).toBe("failed");
    expect(summary.failures.join("\n")).toContain("Critical false accepts");
  });

  it("fails the trial when overrides become routine", () => {
    const trial = buildDefaultSoftGateTrial("2026-05-12T12:00:00.000Z");
    trial.runs = trial.runs.map((run, index) => ({
      ...run,
      overrideUsed: index < 20,
      overrideReason: index < 20 ? "Too many overrides." : ""
    }));

    const summary = evaluateSoftGateTrial(trial);

    expect(summary.status).toBe("failed");
    expect(summary.overrideRate).toBeGreaterThan(0.2);
  });

  it("fails the trial when required repo class coverage is missing", () => {
    const trial = buildDefaultSoftGateTrial("2026-05-12T12:00:00.000Z");
    trial.runs = trial.runs.filter((run) => run.repoClass !== "messy_real_repo");

    const summary = evaluateSoftGateTrial(trial);

    expect(summary.status).toBe("failed");
    expect(summary.failures.join("\n")).toContain("Missing repo class coverage");
  });
});
