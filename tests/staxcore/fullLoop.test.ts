import { describe, expect, it } from "vitest";
import { processObservation } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore full loop", () => {
  it("processes an observation through each canonical layer", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );

    expect(output.auditTrace.layerPath).toEqual([
      "ingest",
      "structure",
      "validate",
      "signal",
      "confidence",
      "frame",
      "context",
      "exchange"
    ]);
    expect(output.auditTrace.candidateIds).toHaveLength(1);
    expect(output.auditTrace.validationIds).toHaveLength(1);
    expect(output.auditTrace.signalIds).toHaveLength(1);
    expect(output.confidence).toBeGreaterThan(0);
  });
});
