import { describe, expect, it } from "vitest";
import {
  formatHumanJudgmentDigest,
  summarizeHumanJudgmentLedger,
  type HumanJudgmentLedger
} from "../src/campaign/HumanJudgmentConsole.js";
import type { ClosedLoopCodexLedger } from "../src/campaign/ClosedLoopCodexCampaign.js";

function sampleClosedLoopLedger(): ClosedLoopCodexLedger {
  return {
    campaignId: "closed_loop_sample",
    tasks: [
      {
        taskId: "closed_loop_001",
        repo: "STAX",
        state: "verified_next_state",
        stateHistory: [{ state: "created", note: "created" }, { state: "verified_next_state", note: "done" }],
        objective: "Sample one",
        staxInitialAudit: "audit",
        staxCodexPrompt: "prompt",
        codexReport: "report",
        diffEvidence: "diff",
        commandEvidence: "command",
        staxPostCodexAudit: "post",
        cleanupPromptsAfterCodex: 0,
        finalOutcome: "verified_next_state",
        falseAccept: false,
        falseBlock: false,
        usefulBlock: true,
        verifiedAccept: false,
        staxInitialPromptUseful: true,
        evalCandidate: true
      },
      {
        taskId: "closed_loop_002",
        repo: "canvas-helper",
        state: "human_review_required",
        stateHistory: [{ state: "created", note: "created" }, { state: "human_review_required", note: "blocked" }],
        objective: "Sample two",
        staxInitialAudit: "audit",
        staxCodexPrompt: "prompt",
        codexReport: "report",
        diffEvidence: "",
        commandEvidence: "",
        staxPostCodexAudit: "post",
        nextAction: "Need screenshot proof.",
        cleanupPromptsAfterCodex: 1,
        finalOutcome: "human_review_required",
        falseAccept: false,
        falseBlock: true,
        usefulBlock: false,
        verifiedAccept: false,
        staxInitialPromptUseful: true,
        evalCandidate: true,
        failurePatterns: ["G1"],
        evalCandidates: ["eval_g1_closed_loop_002"]
      }
    ]
  };
}

describe("Human judgment console", () => {
  it("passes when every closed-loop task has a judgment record and disagreement is captured", () => {
    const ledger: HumanJudgmentLedger = {
      campaignId: "judgment_sample",
      sourceLedger: "fixtures/real_use/closed_loop_20_tasks.json",
      entries: [
        {
          judgmentId: "judgment_001",
          sourceTaskId: "closed_loop_001",
          repo: "STAX",
          humanDecision: "accepted",
          reason: "Useful bounded next action.",
          cleanupPromptsObserved: 0,
          usefulNextAction: true,
          missingProofCaught: true,
          blockedUnnecessarily: false,
          evalCandidate: true,
          promotedLesson: true,
          promotionTarget: "repo_memory:proof_gate"
        },
        {
          judgmentId: "judgment_002",
          sourceTaskId: "closed_loop_002",
          repo: "canvas-helper",
          humanDecision: "blocked_too_hard",
          reason: "The block was stricter than needed.",
          cleanupPromptsObserved: 1,
          usefulNextAction: true,
          missingProofCaught: false,
          blockedUnnecessarily: true,
          evalCandidate: true,
          promotedLesson: false,
          disagreementNote: "STAX required more visual proof than the task needed."
        }
      ]
    };

    const summary = summarizeHumanJudgmentLedger({
      ledger,
      closedLoopLedger: sampleClosedLoopLedger()
    });

    expect(summary.status).toBe("judgment_ready");
    expect(summary.recordedJudgments).toBe(2);
    expect(summary.blockedTooHardCount).toBe(1);
    expect(formatHumanJudgmentDigest(summary)).toContain("status: judgment_ready");
  });

  it("blocks when a closed-loop task has no judgment record", () => {
    const ledger: HumanJudgmentLedger = {
      campaignId: "judgment_sample",
      sourceLedger: "fixtures/real_use/closed_loop_20_tasks.json",
      entries: [
        {
          judgmentId: "judgment_001",
          sourceTaskId: "closed_loop_001",
          repo: "STAX",
          humanDecision: "accepted",
          reason: "Useful bounded next action.",
          cleanupPromptsObserved: 0,
          usefulNextAction: true,
          missingProofCaught: true,
          blockedUnnecessarily: false,
          evalCandidate: true,
          promotedLesson: false
        }
      ]
    };

    const summary = summarizeHumanJudgmentLedger({
      ledger,
      closedLoopLedger: sampleClosedLoopLedger()
    });

    expect(summary.status).toBe("blocked");
    expect(summary.missingSourceTaskIds).toEqual(["closed_loop_002"]);
  });
});
