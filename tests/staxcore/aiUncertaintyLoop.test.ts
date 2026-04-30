import { describe, expect, it } from "vitest";
import { processObservation } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore AI uncertainty loop", () => {
  it("marks ai-derived claims as capped uncertainty until stronger evidence exists", () => {
    const output = processObservation(
      "OCR extracted this candidate from a screenshot.",
      {
        ...measurementProvenance,
        sourceType: "ai_extraction"
      }
    ) as unknown as {
      warnings: string[];
      confidence: number;
      uncertainty: {
        confidenceCaps: string[];
        missingData: string[];
      };
    };

    expect(output.warnings).toContain("AI_EXTRACTION_LIMIT");
    expect(output.uncertainty.confidenceCaps).toContain("ai-only-extraction-cap");
    expect(output.confidence).toBeLessThanOrEqual(0.5);
    expect(Array.isArray(output.uncertainty.missingData)).toBe(true);
  });
});
