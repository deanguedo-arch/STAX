import { describe, expect, it } from "vitest";
import {
  evaluateDogfoodLeague,
  loadDogfoodLeague,
  renderDogfoodObserverReport,
  renderDogfoodRegressionAdditions,
  type DogfoodLeague
} from "../src/sidecar/StaxDogfoodLeague.js";

describe("STAX Phase 2 dogfood observer league", () => {
  it("loads the Phase 2 observer ledger without counting bootstrap observations as exit-gate runs", async () => {
    const league = await loadDogfoodLeague();
    const summary = evaluateDogfoodLeague(league);

    expect(league.runs.length).toBeGreaterThanOrEqual(3);
    expect(summary.bootstrapObservations).toBe(league.runs.length);
    expect(summary.eligibleRuns).toBe(0);
    expect(summary.status).toBe("in_progress");
    expect(summary.promotionGatePassed).toBe(false);
    expect(summary.failures).toContain("Needs 20 eligible observer runs; currently has 0.");
  });

  it("passes only after 20 eligible observer runs meet the Phase 2 thresholds", async () => {
    const baseRun = {
      taskId: "eligible_001",
      mode: "observer" as const,
      countsTowardExitGate: true,
      repo: "STAX",
      task: "Observer-mode task.",
      startedAt: "2026-05-11T00:00:00.000Z",
      finishedAt: "2026-05-11T00:05:00.000Z",
      claimTypes: ["implementation"],
      codexReportSummary: "Codex report was audited.",
      staxVerdict: "Accept" as const,
      humanVerdict: "accepted" as const,
      falseAccept: false,
      falseReject: false,
      criticalFalseAccept: false,
      protocolCompliant: true,
      bypassUsed: false,
      bypassReason: "",
      nextPromptUsableWithoutRewrite: true,
      timeCostMinutes: 5,
      workflowBurdenFindings: [],
      debloatFindings: [],
      missesConvertedToTests: [],
      notes: "Synthetic threshold test."
    };
    const league: DogfoodLeague = {
      leagueId: "threshold_test",
      phase: "phase_2_stax_self_dogfood",
      status: "in_progress",
      thresholds: {
        eligibleRuns: 20,
        criticalFalseAccepts: 0,
        maxFalseRejectRate: 0.1,
        minProtocolComplianceRate: 0.9,
        minNextPromptActionableRate: 0.9
      },
      runs: Array.from({ length: 20 }, (_, index) => ({
        ...baseRun,
        taskId: `eligible_${String(index + 1).padStart(3, "0")}`
      }))
    };

    const summary = evaluateDogfoodLeague(league);

    expect(summary.status).toBe("passed");
    expect(summary.promotionGatePassed).toBe(true);
    expect(summary.failures).toEqual([]);
    expect(summary.protocolComplianceRate).toBe(1);
    expect(summary.nextPromptActionableRate).toBe(1);
  });

  it("fails when an eligible run records a critical false accept", async () => {
    const league = await loadDogfoodLeague();
    const eligibleRun = {
      ...league.runs[0],
      taskId: "critical_false_accept",
      mode: "observer" as const,
      countsTowardExitGate: true,
      falseAccept: true,
      criticalFalseAccept: true
    };
    const result = evaluateDogfoodLeague({
      ...league,
      runs: [eligibleRun]
    });

    expect(result.status).toBe("failed");
    expect(result.criticalFalseAccepts).toBe(1);
    expect(result.failures).toEqual(expect.arrayContaining(["Critical false accepts: 1."]));
  });

  it("renders observer and regression reports from the ledger", async () => {
    const league = await loadDogfoodLeague();
    const report = renderDogfoodObserverReport(league, "2026-05-11T00:00:00.000Z");
    const regressions = renderDogfoodRegressionAdditions(league, "2026-05-11T00:00:00.000Z");

    expect(report).toContain("Eligible observer runs: 0");
    expect(report).toContain("Needs 20 eligible observer runs");
    expect(report).toContain("Workflow Burden Findings");
    expect(regressions).toContain("tests/staxTrialLeague.test.ts");
  });
});
