import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EventCandidate } from "../../../src/staxcore/index.js";
import {
  eventHorizonFromKernelDecision,
  validateCandidate,
  validateEventHorizon
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function candidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    id: "candidate-delegate",
    rawId: "raw-delegate",
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

describe("validateEventHorizon kernel delegation", () => {
  it("keeps the compatibility API but delegates decisions to validateCandidate", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "staxcore", "validate", "index.ts"),
      "utf8"
    );

    expect(source).toContain("validateCandidate(candidate)");
    expect(source).not.toContain("const validation: ValidatedEvent");
    expect(source).not.toContain('state: "VALIDATED"');
    expect(source).not.toContain("createId(");
  });

  it("matches the event horizon projected from the kernel decision", () => {
    const input = candidate();
    const kernelDecision = validateCandidate(input);
    const expected = eventHorizonFromKernelDecision(input, kernelDecision);

    expect(validateEventHorizon(input)).toEqual(expected);
  });

  it("is deterministic for the same candidate", () => {
    const input = candidate();

    expect(validateEventHorizon(input)).toEqual(validateEventHorizon(input));
  });

  it("keeps recommendations rejected through the compatibility API", () => {
    const result = validateEventHorizon(
      candidate({
        claim: "You should change this immediately.",
        provenance: {
          ...measurementProvenance,
          sourceType: "recommendation"
        }
      })
    );

    expect(result.validation.state).toBe("REJECTED");
    expect(result.rejectionReasons).toContain("recommendationDetected");
  });

  it("keeps conflicts explicit through the compatibility API", () => {
    const result = validateEventHorizon(
      candidate({
        unresolvedConflicts: ["source-a:complete vs source-b:incomplete"]
      })
    );

    expect(result.validation.state).toBe("CONFLICTED");
    expect(result.conflict).not.toBeNull();
    expect(result.rejectionReasons).toContain("contradictoryEvidence");
  });
});
