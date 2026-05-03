import { describe, expect, it } from "vitest";
import {
  summarizeClosedLoopCodexCampaign,
  type ClosedLoopCodexTask
} from "../src/campaign/ClosedLoopCodexCampaign.js";

function task(index: number): ClosedLoopCodexTask {
  const outcome = index < 18 ? "verified_next_state" : "clean_failure";
  return {
    taskId: `closed_${index + 1}`,
    repo: ["STAX", "ADMISSION-APP", "brightspacequizexporter", "canvas-helper"][index % 4]!,
    state: outcome,
    stateHistory: [
      { state: "created", note: "task recorded" },
      { state: "scoped", note: "repo and objective scoped" },
      { state: "prompt_generated", note: "bounded Codex prompt written" },
      { state: "codex_report_received", note: "Codex returned a report" },
      { state: "diff_collected", note: "diff evidence recorded" },
      { state: "command_evidence_collected", note: "command evidence recorded" },
      { state: "audited", note: "STAX post-Codex audit recorded" },
      { state: outcome, note: "final outcome recorded" }
    ],
    objective: "Audit repo state to a verified next step.",
    staxInitialAudit: "audit",
    staxCodexPrompt: "prompt",
    codexReport: "report",
    diffEvidence: "diff",
    commandEvidence: "command",
    staxPostCodexAudit: "post audit",
    nextAction: outcome === "clean_failure" ? "Capture the first missing proof artifact before retrying." : undefined,
    failurePatterns: outcome === "clean_failure" ? ["fake_complete_boundary"] : undefined,
    evalCandidates: outcome === "clean_failure" ? ["eval_fake_complete_boundary"] : undefined,
    cleanupPromptsAfterCodex: 0,
    finalOutcome: outcome,
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
    expect(summary.stateCoverageValid).toBe(true);
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

  it("blocks when task-state transitions skip required evidence stages", () => {
    const tasks = Array.from({ length: 20 }, (_, index) => ({ ...task(index) }));
    tasks[0] = {
      ...tasks[0],
      stateHistory: [
        { state: "created", note: "task recorded" },
        { state: "scoped", note: "repo and objective scoped" },
        { state: "audited", note: "skipped evidence collection" },
        { state: "verified_next_state", note: "incorrectly marked verified" }
      ]
    };

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
    expect(summary.stateCoverageValid).toBe(false);
    expect(summary.blockers).toContain("closed-loop task state machine has invalid transitions or missing evidence");
  });
});
