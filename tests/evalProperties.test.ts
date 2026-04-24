import { describe, expect, it } from "vitest";
import { evaluateProperties } from "../src/evaluators/PropertyEvaluator.js";

describe("evaluateProperties", () => {
  it("checks required sections and forbidden patterns", () => {
    const result = evaluateProperties({
      output: "## Signal Units\nKnown fact\n## Unknowns\n- exact date",
      requiredSections: ["## Signal Units", "## Unknowns"],
      forbiddenPatterns: ["obviously"],
      expectedProperties: ["mentions_unknowns"],
      critical: false
    });

    expect(result.pass).toBe(true);
  });

  it("fails when a forbidden pattern appears", () => {
    const result = evaluateProperties({
      output: "## Signal Units\nHe is obviously disciplined.\n## Unknowns",
      requiredSections: ["## Signal Units"],
      forbiddenPatterns: ["obviously"],
      expectedProperties: [],
      critical: false
    });

    expect(result.pass).toBe(false);
    expect(result.failReasons.join(" ")).toContain("forbidden");
  });

  it("enforces minimum signal units for STAX evals", () => {
    const result = evaluateProperties({
      output: "## Signal Units\n### SU-001\n- Type: training\n## Unknowns",
      requiredSections: ["## Signal Units"],
      forbiddenPatterns: [],
      expectedProperties: [],
      minSignalUnits: 2,
      critical: true
    });

    expect(result.pass).toBe(false);
    expect(result.failReasons.join(" ")).toContain("minimum signal units");
    expect(result.criticalFailure).toBe(true);
  });
});
