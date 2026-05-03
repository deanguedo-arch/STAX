import { describe, expect, it } from "vitest";
import { routeClosedLoopFailurePatterns } from "../src/campaign/FailurePatternRouter.js";
import type { ClosedLoopCodexTask } from "../src/campaign/ClosedLoopCodexCampaign.js";

function baseTask(): ClosedLoopCodexTask {
  return {
    taskId: "closed_loop_failure",
    repo: "brightspacequizexporter",
    state: "rejected_fake_complete",
    stateHistory: [
      { state: "created", note: "task recorded" },
      { state: "scoped", note: "repo and objective scoped" },
      { state: "prompt_generated", note: "bounded Codex prompt written" },
      { state: "codex_report_received", note: "Codex returned a report" },
      { state: "diff_collected", note: "diff evidence recorded" },
      { state: "audited", note: "STAX post-Codex audit recorded" },
      { state: "rejected_fake_complete", note: "fake-complete claim rejected" }
    ],
    objective: "Reject fake-complete claims until real proof exists.",
    staxInitialAudit: "Need proof before accepting completion.",
    staxCodexPrompt: "Capture the first real proof artifact.",
    codexReport: "Codex reported the fix as complete.",
    diffEvidence: "fixture-only diff",
    commandEvidence: "no behavior proof supplied.",
    staxPostCodexAudit: "Fake-complete claim rejected until real proof exists.",
    cleanupPromptsAfterCodex: 0,
    finalOutcome: "rejected_fake_complete",
    falseAccept: false,
    falseBlock: false,
    usefulBlock: true,
    verifiedAccept: false,
    staxInitialPromptUseful: true,
    evalCandidate: true,
    failurePatterns: ["A4", "C14"],
    evalCandidates: ["eval_a4_closed_loop_failure", "eval_c14_closed_loop_failure"],
    nextAction: "Request the first real proof artifact."
  };
}

describe("routeClosedLoopFailurePatterns", () => {
  it("routes fixture-only fake-complete misses into proof and diff taxonomy", () => {
    const result = routeClosedLoopFailurePatterns(baseTask());

    expect(result.routedPatterns.map((pattern) => pattern.patternId)).toEqual(expect.arrayContaining(["A1", "A4", "C14"]));
    expect(result.evalCandidateIds).toContain("eval_a1_closed_loop_failure");
  });

  it("routes wrong-repo and wrong-branch misses when evidence says so", () => {
    const result = routeClosedLoopFailurePatterns({
      ...baseTask(),
      taskId: "closed_loop_cross_repo",
      codexReport: "Cross-repo claim used the wrong repo and wrong branch output.",
      diffEvidence: "No repo mutation.",
      commandEvidence: "wrong branch output and repo mismatch recorded."
    });

    expect(result.routedPatterns.map((pattern) => pattern.patternId)).toEqual(expect.arrayContaining(["B1", "B5"]));
  });

  it("routes promotion-gate blocker misses into command-selection taxonomy", () => {
    const result = routeClosedLoopFailurePatterns({
      ...baseTask(),
      taskId: "closed_loop_017",
      objective: "Audit promotion-gate blockers honestly.",
      codexReport: "promotion gate blocked on missing clean run count and operating window.",
      diffEvidence: "No repo mutation.",
      commandEvidence: "promotion gate output captured.",
      staxPostCodexAudit: "9.5 claim blocked cleanly until gate is green.",
      nextAction: "Record the blocker and capture the first missing proof step before retrying."
    });

    expect(result.routedPatterns.map((pattern) => pattern.patternId)).toContain("E4");
    expect(result.evalCandidateIds).toContain("eval_e4_closed_loop_017");
  });

  it("routes brightspace context contamination into the cross-lane taxonomy", () => {
    const result = routeClosedLoopFailurePatterns({
      ...baseTask(),
      taskId: "closed_loop_brightspace_context_leak",
      objective: "Audit brightspace dependency readiness only.",
      codexReport:
        "Initial answer leaked ADMISSION-APP/TestFlight context into the brightspacequizexporter dependency task.",
      diffEvidence: "No brightspace parser/source edits.",
      commandEvidence: "No local brightspace command output was supplied."
    });

    expect(result.routedPatterns.map((pattern) => pattern.patternId)).toContain("B7");
    expect(result.evalCandidateIds).toContain("eval_b7_closed_loop_brightspace_context_leak");
  });
});
