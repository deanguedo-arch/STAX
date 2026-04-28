import { describe, expect, it } from "vitest";
import { FirstPassIntegrityGate } from "../src/compare/FirstPassIntegrityGate.js";

describe("FirstPassIntegrityGate", () => {
  it("allows a locked blind first-pass STAX win to be labelled blind_first_pass", () => {
    const result = new FirstPassIntegrityGate().evaluate({
      fixtureId: "holdout-001",
      firstPassLocked: true,
      firstPassScoreRecorded: true,
      lockedFixturePath: "fixtures/problem_benchmark/locked/holdout-001.json",
      firstPassWinner: "stax_better",
      currentWinner: "stax_better",
      requestedClaimLevel: "blind_first_pass"
    });

    expect(result.allowed).toBe(true);
    expect(result.claimLevel).toBe("blind_first_pass");
    expect(result.firstPassEligible).toBe(true);
  });

  it("blocks a corrected fixture from being labelled blind_first_pass", () => {
    const result = new FirstPassIntegrityGate().evaluate({
      fixtureId: "holdout-corrected",
      firstPassLocked: true,
      firstPassScoreRecorded: true,
      lockedFixturePath: "fixtures/problem_benchmark/locked/holdout-corrected.json",
      correctionCandidatePath: "fixtures/problem_benchmark/candidates/holdout-corrected.json",
      postCorrection: true,
      firstPassWinner: "tie",
      currentWinner: "stax_better",
      requestedClaimLevel: "blind_first_pass"
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredLabel).toBe("post_correction_pass");
    expect(result.reasons.join(" ")).toContain("Corrected evidence must stay labelled post_correction_pass");
  });

  it("blocks locked fixture overwrite attempts during scoring", () => {
    const result = new FirstPassIntegrityGate().evaluate({
      fixtureId: "locked-overwrite",
      firstPassLocked: true,
      firstPassScoreRecorded: true,
      lockedFixturePath: "fixtures/problem_benchmark/locked/locked-overwrite.json",
      firstPassWinner: "stax_better",
      currentWinner: "stax_better",
      attemptedLockedFixtureOverwrite: true,
      requestedClaimLevel: "blind_first_pass"
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Locked first-pass fixture cannot be overwritten during scoring.");
  });

  it("keeps post-correction evidence labelled post_correction_pass", () => {
    const result = new FirstPassIntegrityGate().evaluate({
      fixtureId: "post-correction",
      correctionCandidatePath: "fixtures/problem_benchmark/candidates/post-correction.json",
      postCorrection: true,
      firstPassWinner: "external_better",
      currentWinner: "stax_better"
    });

    expect(result.allowed).toBe(true);
    expect(result.claimLevel).toBe("post_correction_pass");
    expect(result.requiredLabel).toBe("post_correction_pass");
  });

  it("does not allow superiority_candidate from corrected-only evidence", () => {
    const result = new FirstPassIntegrityGate().evaluate({
      fixtureId: "corrected-superiority",
      correctionCandidatePath: "fixtures/problem_benchmark/candidates/corrected-superiority.json",
      postCorrection: true,
      firstPassWinner: "tie",
      currentWinner: "stax_better",
      requestedClaimLevel: "superiority_candidate"
    });

    expect(result.allowed).toBe(false);
    expect(result.superiorityEligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("Superiority candidate requires locked first-pass evidence");
  });
});
