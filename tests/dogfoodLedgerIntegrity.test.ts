import { describe, expect, it } from "vitest";
import { evaluateDogfoodLeague, loadDogfoodLeague } from "../src/sidecar/StaxDogfoodLeague.js";

describe("dogfood ledger integrity", () => {
  it("keeps eligible observer run ids unique and quality metrics clean", async () => {
    const league = await loadDogfoodLeague();
    const eligible = league.runs.filter((run) => run.mode === "observer" && run.countsTowardExitGate);
    const ids = eligible.map((run) => run.taskId);
    const summary = evaluateDogfoodLeague(league);

    expect(new Set(ids).size).toBe(ids.length);
    expect(summary.criticalFalseAccepts).toBe(0);
    expect(summary.falseRejectRate).toBeLessThanOrEqual(0.1);
    expect(summary.protocolComplianceRate).toBe(1);
    expect(summary.nextPromptActionableRate).toBe(1);
  });

  it("keeps every eligible observer run tied to a real task summary", async () => {
    const league = await loadDogfoodLeague();
    const eligible = league.runs.filter((run) => run.mode === "observer" && run.countsTowardExitGate);

    expect(eligible.length).toBeGreaterThan(0);
    for (const run of eligible) {
      expect(run.task.trim().length).toBeGreaterThan(20);
      expect(run.codexReportSummary.trim().length).toBeGreaterThan(20);
      expect(run.notes.trim().length).toBeGreaterThan(20);
    }
  });
});
