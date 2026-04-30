import { describe, expect, it } from "vitest";
import { processObservation } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore no-silent-degradation", () => {
  it("outputs explicit uncertainty when required data is missing", () => {
    const output = processObservation(
      "Observation with missing occurredAt provenance metadata.",
      { ...measurementProvenance, occurredAt: undefined }
    ) as unknown as {
      status: string;
      warnings: string[];
      uncertainty: {
        reasons: string[];
        missingData: string[];
      };
    };

    expect(output.status).toBe("warning");
    expect(output.warnings).toContain("MISSING_DATA");
    expect(output.uncertainty.missingData).toContain("occurredAt");
    expect(output.uncertainty.reasons.length).toBeGreaterThan(0);
  });
});
