import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("rollout phase artifacts", () => {
  it("keeps rollout status and markdown report in sync", () => {
    const status = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/releases/ROLLOUT_PHASE_GATE/status.json"), "utf8")) as {
      status: string;
      phases: Array<{ title: string; status: string }>;
    };
    const report = fs.readFileSync(path.join(process.cwd(), "docs/releases/ROLLOUT_PHASE_GATE/report.md"), "utf8");

    expect(report).toContain(`Status: ${status.status}`);
    for (const phase of status.phases) {
      expect(report).toContain(phase.title);
      expect(report).toContain(`Status: ${phase.status}`);
    }
  });

  it("keeps later phases free of prerequisite blockers once the rollout gate passes", () => {
    const status = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/releases/ROLLOUT_PHASE_GATE/status.json"), "utf8")) as {
      phases: Array<{ phase: string; failures: string[] }>;
    };
    const phase4 = status.phases.find((phase) => phase.phase === "phase_4_soft_gate_trial");

    expect(phase4?.failures).toEqual([]);
  });
});
