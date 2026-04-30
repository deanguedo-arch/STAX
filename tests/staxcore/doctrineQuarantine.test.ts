import { describe, expect, it } from "vitest";
import { processObservation } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore doctrine quarantine", () => {
  it("rejects opinion-source truth validation", () => {
    const output = processObservation(
      "This is true because I feel it is.",
      { ...measurementProvenance, sourceType: "opinion" }
    );

    expect(output.warnings).toContain("OPINION_DETECTED");
    expect(output.confidence).toBeLessThanOrEqual(0.65);
  });

  it("flags recommendation-source inputs", () => {
    const output = processObservation("You should do this.", {
      ...measurementProvenance,
      sourceType: "recommendation"
    });

    expect(output.warnings).toContain("RECOMMENDATION_DETECTED");
  });
});
