import { describe, expect, it } from "vitest";
import type { EventCandidate } from "../../../src/staxcore/index.js";
import {
  assertKernelTruth,
  evaluateCandidate,
  readKernelEvaluationTruth,
  readKernelTruth
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function candidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    id: "candidate-public-api",
    rawId: "raw-public-api",
    claim: "Measured observation entered the system.",
    state: "CANDIDATE",
    provenance: measurementProvenance,
    uncertaintyReason: [],
    missingData: [],
    confidenceCaps: [],
    unresolvedConflicts: [],
    ...overrides
  };
}

describe("kernel public API", () => {
  it("issues sealed kernel truth with ledger authority", () => {
    const evaluation = evaluateCandidate(candidate());
    const truth = readKernelEvaluationTruth(evaluation);

    assertKernelTruth(evaluation.truth);
    expect(truth.validation.state).toBe("VALIDATED");
    expect(truth.ledgerRecord.id).toBe(evaluation.ledgerRecordId);
    expect(truth.ledgerRecord.hash).toBe(evaluation.ledgerHash);
    expect(truth.ledgerValid).toBe(true);
  });

  it("does not expose mutable kernel truth internals", () => {
    const evaluation = evaluateCandidate(candidate());
    const view = readKernelTruth(evaluation.truth);
    const originalHash = view.ledgerRecord.hash;
    (view.ledgerRecord as { hash: string }).hash = "tampered";

    expect(readKernelTruth(evaluation.truth).ledgerRecord.hash).toBe(originalHash);
  });

  it("rejects unsealed truth-shaped objects", () => {
    expect(() =>
      assertKernelTruth({
        validation: { state: "VALIDATED" },
        ledgerRecord: { hash: "fake" }
      })
    ).toThrow(/not sealed kernel truth/);
  });

  it("keeps recommendation candidates rejected at the public API boundary", () => {
    const evaluation = evaluateCandidate(
      candidate({
        claim: "You should change this immediately.",
        provenance: {
          ...measurementProvenance,
          sourceType: "recommendation"
        }
      })
    );

    expect(evaluation.eventHorizon.validation.state).toBe("REJECTED");
    expect(evaluation.eventHorizon.rejectionReasons).toContain(
      "recommendationDetected"
    );
  });
});
