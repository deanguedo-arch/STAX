import { describe, expect, it } from "vitest";
import { processObservation } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore complete loop", () => {
  it("runs raw -> candidate -> validated -> signal -> confidence -> envelope with audit trace", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    ) as unknown as {
      status: string;
      assumptions: string[];
      conflicts: string[];
      uncertainty: { reasons: string[]; missingData: string[] };
      auditTrace: { layerPath: string[]; inputId: string; validationIds: string[] };
      data: { data: { data: { validation: { state: string } } } };
    };

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
    expect(output.auditTrace.inputId).toMatch(/^raw_/);
    expect(output.auditTrace.validationIds).toHaveLength(1);
    expect(output.data.data.data.validation.state).toMatch(
      /VALIDATED|CONFLICTED|REJECTED/
    );
    expect(output.assumptions).toEqual([]);
    expect(output.conflicts).toEqual([]);
    expect(output.status).toMatch(/ok|warning|rejected/);
    expect(Array.isArray(output.uncertainty.reasons)).toBe(true);
    expect(Array.isArray(output.uncertainty.missingData)).toBe(true);
  });
});
