import { describe, expect, it } from "vitest";
import { evaluateRolloutPhaseGate, renderRolloutPhaseGateReport } from "../src/sidecar/RolloutPhaseGate.js";

describe("rollout phase gate", () => {
  it("keeps completed phases passed and blocks later phases on explicit proof gates", async () => {
    const report = await evaluateRolloutPhaseGate(process.cwd(), "2026-05-12T12:00:00.000Z");
    const byPhase = Object.fromEntries(report.phases.map((phase) => [phase.phase, phase]));

    expect(byPhase.phase_0_baseline.status).toBe("passed");
    expect(byPhase.phase_1_fixture_league.status).toBe("passed");
    expect(byPhase.phase_2_dogfood_league.status).toBe("passed");
    expect(byPhase.phase_2_dogfood_league.failures).toEqual([]);
    expect(byPhase.phase_3_claim_extraction.status).toBe("passed");
    expect(byPhase.phase_4_soft_gate_trial.status).toBe("passed");
    expect(byPhase.phase_5_product_surface.status).toBe("passed");
    expect(byPhase.phase_6_limited_hard_gate.status).toBe("passed");
    expect(report.status).toBe("passed");
  });

  it("renders a reviewer-readable phase status report", async () => {
    const report = await evaluateRolloutPhaseGate(process.cwd(), "2026-05-12T12:00:00.000Z");
    const rendered = renderRolloutPhaseGateReport(report);

    expect(rendered).toContain("# STAX Rollout Phase Gate");
    expect(rendered).toContain("Phase 2 - STAX Self-Dogfood League");
    expect(rendered).toContain("Phase 6 - Limited Hard Gate");
    expect(rendered).toContain("Next action:");
  });
});
