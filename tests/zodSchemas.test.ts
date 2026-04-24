import { describe, expect, it } from "vitest";
import {
  CorrectionItemSchema,
  RiskScoreSchema,
  RaxModeSchema,
  StaxFitnessOutputSchema
} from "../src/schemas/zodSchemas.js";

describe("zod schemas", () => {
  it("accepts valid schema examples", () => {
    expect(RaxModeSchema.parse("stax_fitness")).toBe("stax_fitness");
    expect(
      RiskScoreSchema.parse({
        intent: 0,
        harm: 0,
        actionability: 0,
        privacy: 0,
        exploitation: 0,
        regulatedAdvice: 0,
        systemIntegrity: 0,
        total: 0,
        labels: []
      }).total
    ).toBe(0);
  });

  it("rejects invalid risk scores", () => {
    expect(() => RiskScoreSchema.parse({ intent: "bad", labels: [] })).toThrow();
  });

  it("rejects invalid modes", () => {
    expect(() => RaxModeSchema.parse("invalid")).toThrow();
  });

  it("rejects invalid correction error types", () => {
    expect(() =>
      CorrectionItemSchema.parse({
        correctionId: "corr-1",
        runId: "run-1",
        createdAt: new Date().toISOString(),
        originalOutput: "bad",
        correctedOutput: "good",
        reason: "reason",
        errorType: "not_allowed",
        tags: [],
        approved: false,
        promoteToEval: false,
        promoteToTraining: false
      })
    ).toThrow();
  });

  it("rejects invalid STAX fitness output", () => {
    expect(() =>
      StaxFitnessOutputSchema.parse({
        signalUnits: [],
        timeline: [],
        patternCandidates: [],
        deviations: [],
        unknowns: []
      })
    ).toThrow();
  });
});
