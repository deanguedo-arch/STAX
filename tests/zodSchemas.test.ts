import { describe, expect, it } from "vitest";
import {
  CorrectionItemSchema,
  CriticReviewSchema,
  ProviderRoleSchema,
  RiskScoreSchema,
  RunTraceSchema,
  RaxModeSchema,
  RepairResultSchema,
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

  it("enforces hardening schemas for critic, repair, provider roles, and run trace", () => {
    expect(ProviderRoleSchema.parse("critic")).toBe("critic");
    expect(() => ProviderRoleSchema.parse("judge")).toThrow();
    expect(
      CriticReviewSchema.parse({
        pass: false,
        severity: "major",
        issuesFound: ["unsupported"],
        requiredFixes: ["remove unsupported claim"],
        policyViolations: [],
        schemaIssues: [],
        unsupportedClaims: ["disciplined person"],
        forbiddenPhrases: ["he is clearly"],
        confidence: "high"
      }).severity
    ).toBe("major");
    expect(
      RepairResultSchema.parse({
        attempted: true,
        pass: false,
        repairedOutput: "output",
        issuesRemaining: ["missing section"],
        repairCount: 1
      }).repairCount
    ).toBe(1);
    expect(() =>
      RunTraceSchema.parse({
        runId: "run-1",
        createdAt: new Date().toISOString(),
        runtimeVersion: "0.1.0",
        provider: "mock",
        model: "mock-model",
        providerRoles: { generator: "mock", critic: "mock", evaluator: "mock", classifier: "rules" },
        criticModel: "mock-critic",
        evaluatorModel: "mock-evaluator",
        classifierModel: "rules",
        temperature: 0.2,
        criticTemperature: 0,
        evalTemperature: 0,
        topP: 0.9,
        seed: 42,
        mode: "analysis",
        modeConfidence: 1,
        boundaryMode: "allow",
        selectedAgent: "analyst",
        policiesApplied: [],
        criticPasses: 1,
        repairPasses: 0,
        formatterPasses: 1,
        schemaRetries: 0,
        latencyMs: 1,
        toolCalls: [],
        errors: [],
        modelCalls: [],
        validation: {},
        route: {},
        replayable: true
      })
    ).not.toThrow();
  });
});
