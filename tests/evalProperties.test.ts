import { describe, expect, it } from "vitest";
import { evaluateProperties } from "../src/evaluators/PropertyEvaluator.js";

describe("evaluateProperties", () => {
  it("checks required sections and forbidden patterns", () => {
    const result = evaluateProperties({
      output: "## Signal Units\nKnown fact\n## Unknowns\n- exact date",
      requiredSections: ["## Signal Units", "## Unknowns"],
      forbiddenPatterns: ["obviously"],
      expectedProperties: ["mentions_unknowns"]
    });

    expect(result.pass).toBe(true);
  });

  it("fails when a forbidden pattern appears", () => {
    const result = evaluateProperties({
      output: "## Signal Units\nHe is obviously disciplined.\n## Unknowns",
      requiredSections: ["## Signal Units"],
      forbiddenPatterns: ["obviously"],
      expectedProperties: []
    });

    expect(result.pass).toBe(false);
    expect(result.failReasons.join(" ")).toContain("forbidden");
  });
});
