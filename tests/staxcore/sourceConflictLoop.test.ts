import { describe, expect, it } from "vitest";
import {
  evaluateCandidate,
  generateSignals,
  ingestRawObservation,
  readKernelEvaluationTruth,
  scoreConfidence,
  structureCandidate
} from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore source conflict loop", () => {
  it("surfaces conflict candidate, reduces confidence, and avoids silent resolution", () => {
    const raw = ingestRawObservation(
      "Source A says complete; source B says incomplete.",
      measurementProvenance
    );
    const candidate = structureCandidate(raw);
    candidate.unresolvedConflicts.push("sourceA:complete");
    candidate.unresolvedConflicts.push("sourceB:incomplete");

    const evaluation = evaluateCandidate(candidate);
    const horizon = evaluation.eventHorizon;
    const validation = readKernelEvaluationTruth(evaluation).validation;
    const signals = generateSignals([evaluation.truth]);
    const confidence = scoreConfidence([validation], signals);

    expect(horizon.conflict).not.toBeNull();
    expect(horizon.validation.state).toBe("CONFLICTED");
    expect(horizon.rejectionReasons).toContain("contradictoryEvidence");
    expect(confidence.caps).toContain("conflicting-evidence-cap");
    expect(confidence.score).toBeLessThanOrEqual(0.55);
  });
});
