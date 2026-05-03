import { describe, expect, it } from "vitest";
import {
  buildClosedLoopEvidenceSnapshot,
  replayClosedLoopEvidenceLedger
} from "../src/campaign/ClosedLoopEvidenceLedger.js";
import type { ClosedLoopCodexTask } from "../src/campaign/ClosedLoopCodexCampaign.js";

function task(index: number): ClosedLoopCodexTask {
  return {
    taskId: `closed_${index + 1}`,
    repo: ["STAX", "ADMISSION-APP", "brightspacequizexporter", "canvas-helper"][index % 4]!,
    state: "verified_next_state",
    stateHistory: [
      { state: "created", note: "task recorded" },
      { state: "scoped", note: "repo and objective scoped" },
      { state: "prompt_generated", note: "bounded Codex prompt written" },
      { state: "codex_report_received", note: "Codex returned a report" },
      { state: "diff_collected", note: "diff evidence recorded" },
      { state: "command_evidence_collected", note: "command evidence recorded" },
      { state: "audited", note: "STAX post-Codex audit recorded" },
      { state: "verified_next_state", note: "final outcome recorded" }
    ],
    objective: "Audit repo state to a verified next step.",
    staxInitialAudit: "audit",
    staxCodexPrompt: "prompt",
    codexReport: "report",
    diffEvidence: `diff ${index}`,
    commandEvidence: `command ${index}`,
    staxPostCodexAudit: "post audit",
    cleanupPromptsAfterCodex: 0,
    finalOutcome: "verified_next_state",
    falseAccept: false,
    falseBlock: false,
    usefulBlock: index % 2 === 0,
    verifiedAccept: index % 3 === 0,
    staxInitialPromptUseful: true,
    evalCandidate: false
  };
}

describe("replayClosedLoopEvidenceLedger", () => {
  it("builds deterministic replay metadata for closed-loop tasks", () => {
    const summary = replayClosedLoopEvidenceLedger({
      ledger: {
        campaignId: "closed_loop",
        tasks: Array.from({ length: 20 }, (_, index) => task(index))
      }
    });

    expect(summary.replayValid).toBe(true);
    expect(summary.deterministic).toBe(true);
    expect(summary.chainValid).toBe(true);
    expect(summary.snapshotCount).toBe(20);
    expect(summary.auditTraceIds).toHaveLength(20);
  });

  it("uses stable task evidence to create the same snapshot hash twice", () => {
    const snapshotA = buildClosedLoopEvidenceSnapshot({ task: task(0) });
    const snapshotB = buildClosedLoopEvidenceSnapshot({ task: task(0) });

    expect(snapshotA).toEqual(snapshotB);
    expect(snapshotA.auditTraceId).toMatch(/^trace_/);
  });

  it("flags duplicate deterministic trace ids when task identity is duplicated", () => {
    const repeated = task(0);
    const summary = replayClosedLoopEvidenceLedger({
      ledger: {
        campaignId: "closed_loop",
        tasks: [repeated, repeated]
      }
    });

    expect(summary.replayValid).toBe(false);
    expect(summary.issues.some((issue) => issue.includes("duplicate auditTraceId"))).toBe(true);
  });
});
