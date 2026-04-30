import { describe, expect, it } from "vitest";
import {
  ingestRawObservation,
  structureCandidate,
  validateEventHorizon
} from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore event horizon", () => {
  it("rejects recommendation-source candidates", () => {
    const raw = ingestRawObservation("You should change this immediately.", {
      ...measurementProvenance,
      sourceType: "recommendation"
    });
    const candidate = structureCandidate(raw);
    const result = validateEventHorizon(candidate);

    expect(result.validation.state).toBe("REJECTED");
    expect(result.rejectionReasons).toContain("recommendationDetected");
  });

  it("surfaces conflicts instead of silently selecting truth", () => {
    const raw = ingestRawObservation("Two sources disagree on status.", {
      ...measurementProvenance
    });
    const candidate = structureCandidate(raw);
    candidate.unresolvedConflicts.push(
      "source-a:complete vs source-b:incomplete"
    );

    const result = validateEventHorizon(candidate);
    expect(result.validation.state).toBe("CONFLICTED");
    expect(result.conflict).not.toBeNull();
    expect(result.rejectionReasons).toContain("contradictoryEvidence");
  });

  it("flags missing evidence chain", () => {
    const raw = ingestRawObservation(
      "Evidence chain is incomplete.",
      measurementProvenance
    );
    const candidate = structureCandidate(raw);
    candidate.provenance.sourceId = "";
    const result = validateEventHorizon(candidate);

    expect(result.evidenceChainValid).toBe(false);
    expect(result.rejectionReasons).toContain("insufficientEvidence");
  });
});
