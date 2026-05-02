import { describe, expect, it } from "vitest";
import {
  summarizeClosedLoopCodexCampaign,
  type ClosedLoopCodexTask
} from "../src/campaign/ClosedLoopCodexCampaign.js";

function task(index: number): ClosedLoopCodexTask {
  return {
    taskId: `closed_${index + 1}`,
    repo: ["STAX", "ADMISSION-APP", "brightspacequizexporter", "canvas-helper"][index % 4]!,
    objective: "Audit repo state to a verified next step.",
    staxInitialAudit: "audit",
    staxCodexPrompt: "prompt",
    codexReport: "report",
    diffEvidence: "diff",
    commandEvidence: "command",
    staxPostCodexAudit: "post audit",
    cleanupPromptsAfterCodex: 0,
    finalOutcome: index < 18 ? "verified_next_state" : "clean_failure",
    falseAccept: false,
    falseBlock: index === 19,
    usefulBlock: index < 10,
    verifiedAccept: index < 8,
    staxInitialPromptUseful: true,
    evalCandidate: index === 19
  };
}

describe("summarizeClosedLoopCodexCampaign", () => {
  it("passes when the 20-task closed-loop gate is met", () => {
    const summary = summarizeClosedLoopCodexCampaign({
      ledger: {
        campaignId: "closed_loop",
        tasks: Array.from({ length: 20 }, (_, index) => task(index))
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

    expect(summary.status).toBe("closed_loop_passed");
    expect(summary.falseAccepts).toBe(0);
    expect(summary.cleanupReductionPct).toBe(100);
    expect(summary.verifiedNextStateRate).toBe(90);
  });

  it("blocks if any false accept appears", () => {
    const tasks = Array.from({ length: 20 }, (_, index) => ({ ...task(index) }));
    tasks[0] = { ...tasks[0], falseAccept: true, evalCandidate: true };

    const summary = summarizeClosedLoopCodexCampaign({
      ledger: {
        campaignId: "closed_loop",
        tasks
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

    expect(summary.status).toBe("closed_loop_blocked");
    expect(summary.blockers).toContain("false accept recorded in closed-loop campaign");
  });
});
