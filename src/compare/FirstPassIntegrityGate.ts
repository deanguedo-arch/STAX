import {
  BenchmarkClaimLevelSchema,
  FirstPassIntegrityInputSchema,
  FirstPassIntegrityResultSchema,
  type BenchmarkClaimLevel,
  type FirstPassIntegrityInput,
  type FirstPassIntegrityResult
} from "./FirstPassIntegritySchemas.js";

export class FirstPassIntegrityGate {
  evaluate(input: FirstPassIntegrityInput): FirstPassIntegrityResult {
    const parsed = FirstPassIntegrityInputSchema.parse(input);
    const reasons: string[] = [];

    if (parsed.attemptedLockedFixtureOverwrite) {
      reasons.push("Locked first-pass fixture cannot be overwritten during scoring.");
    }

    const firstPassGaps = firstPassEligibilityGaps(parsed);
    const firstPassEligible = firstPassGaps.length === 0;
    const superiorityEligible = firstPassEligible &&
      parsed.firstPassWinner === "stax_better" &&
      parsed.currentWinner === "stax_better";
    const requiredLabel = requiredLabelFor(parsed, firstPassEligible, superiorityEligible);
    const requested = parsed.requestedClaimLevel ?? requiredLabel;

    if (!claimAllowed(requested, requiredLabel, superiorityEligible)) {
      reasons.push(`Requested claim level ${requested} exceeds allowed label ${requiredLabel}.`);
      reasons.push(...firstPassGaps);
    }
    if (requested === "superiority_candidate" && !superiorityEligible) {
      reasons.push("Superiority candidate requires locked first-pass evidence with STAX better before and after scoring.");
    }

    return FirstPassIntegrityResultSchema.parse({
      fixtureId: parsed.fixtureId,
      allowed: reasons.length === 0,
      claimLevel: reasons.length === 0 ? requested : requiredLabel,
      firstPassEligible,
      superiorityEligible,
      reasons,
      requiredLabel,
      lockedFixturePath: parsed.lockedFixturePath,
      correctionCandidatePath: parsed.correctionCandidatePath
    });
  }
}

function firstPassEligibilityGaps(input: FirstPassIntegrityInput): string[] {
  const gaps: string[] = [];
  if (!input.firstPassLocked) {
    gaps.push("Blind first-pass claim requires firstPassLocked=true.");
  }
  if (!input.firstPassScoreRecorded) {
    gaps.push("Blind first-pass claim requires firstPassScoreRecorded=true.");
  }
  if (!input.lockedFixturePath) {
    gaps.push("Blind first-pass claim requires a lockedFixturePath.");
  }
  if (input.postCorrection) {
    gaps.push("Corrected evidence must stay labelled post_correction_pass.");
  }
  if (input.staxAnswerEditedAfterExternal) {
    gaps.push("STAX answer edited after external capture cannot be labelled blind_first_pass.");
  }
  if (input.firstPassWinner && input.firstPassWinner !== "stax_better") {
    gaps.push(`First-pass winner was ${input.firstPassWinner}; do not hide tie/loss history.`);
  }
  return gaps;
}

function requiredLabelFor(
  input: FirstPassIntegrityInput,
  firstPassEligible: boolean,
  superiorityEligible: boolean
): BenchmarkClaimLevel {
  if (input.postCorrection || input.staxAnswerEditedAfterExternal || input.correctionCandidatePath) {
    return "post_correction_pass";
  }
  if (superiorityEligible && input.requestedClaimLevel === "superiority_candidate") {
    return "superiority_candidate";
  }
  if (firstPassEligible) {
    return "blind_first_pass";
  }
  return "trained_slice_pass";
}

function claimAllowed(requested: BenchmarkClaimLevel, required: BenchmarkClaimLevel, superiorityEligible: boolean): boolean {
  BenchmarkClaimLevelSchema.parse(requested);
  if (requested === required) return true;
  if (requested === "superiority_candidate") return superiorityEligible;
  if (required === "post_correction_pass") return false;
  return claimRank(requested) <= claimRank(required);
}

function claimRank(level: BenchmarkClaimLevel): number {
  switch (level) {
    case "trained_slice_pass":
      return 1;
    case "post_correction_pass":
      return 2;
    case "blind_first_pass":
      return 3;
    case "superiority_candidate":
      return 4;
  }
}
