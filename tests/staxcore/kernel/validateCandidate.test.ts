import { describe, expect, it } from "vitest";
import type { EventCandidate } from "../../../src/staxcore/index.js";
import { processCandidate, validateCandidate } from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function candidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    id: "candidate-fixed",
    rawId: "raw-fixed",
    claim: "Dean trained Saturday.",
    state: "CANDIDATE",
    provenance: measurementProvenance,
    uncertaintyReason: [],
    missingData: [],
    confidenceCaps: [],
    unresolvedConflicts: [],
    ...overrides
  };
}

describe("staxcore kernel validateCandidate", () => {
  it("rejects a candidate without required provenance", () => {
    const result = validateCandidate(
      candidate({
        provenance: {
          ...measurementProvenance,
          sourceId: "",
          capturedBy: "",
          rawReference: ""
        }
      })
    );

    expect(result.outcome).toBe("rejected");
    expect(result.rejectionReasons).toContain("invalidSource");
    if (result.outcome === "rejected") {
      expect(result.rejection.warnings).toContain("MISSING_PROVENANCE");
    }
  });

  it("prevents recommendation text from becoming validated truth", () => {
    const result = validateCandidate(
      candidate({
        claim: "You should change the plan immediately.",
        provenance: {
          ...measurementProvenance,
          sourceType: "recommendation"
        }
      })
    );

    expect(result.outcome).toBe("rejected");
    expect(result.rejectionReasons).toContain("recommendationDetected");
  });

  it("marks conflicts explicitly instead of selecting truth", () => {
    const result = validateCandidate(
      candidate({
        unresolvedConflicts: ["source-a:complete vs source-b:incomplete"]
      })
    );

    expect(result.outcome).toBe("conflicted");
    expect(result.rejectionReasons).toContain("contradictoryEvidence");
    if (result.outcome === "conflicted") {
      expect(result.event.state).toBe("CONFLICTED");
    }
  });

  it("is deterministic for the same candidate input", () => {
    const input = candidate();
    const first = processCandidate(input);
    const second = processCandidate(input);

    expect(second.decision).toEqual(first.decision);
    expect(second.ledgerRecord).toEqual(first.ledgerRecord);
    expect(second.ledgerValid).toBe(true);
  });
});
