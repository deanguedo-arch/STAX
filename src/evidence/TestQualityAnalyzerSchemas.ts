import { z } from "zod";

export const TestQualityVerdictSchema = z.enum(["accept", "provisional", "reject"]);

export const TestQualityFindingIdSchema = z.enum([
  "meaningful_behavior_assertion",
  "no_assertion",
  "skipped_test",
  "snapshot_only_risk",
  "mock_only_coverage",
  "fixture_golden_mutation",
  "integration_evidence_present"
]);

export const TestQualityFindingSchema = z.object({
  id: TestQualityFindingIdSchema,
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string().min(1)
});

export const TestQualityAnalyzerInputSchema = z.object({
  caseId: z.string().optional(),
  filePath: z.string().min(1),
  patch: z.string().default(""),
  intendedClaim: z.enum(["test", "behavior"]).default("behavior")
});

export const TestQualityAnalyzerResultSchema = z.object({
  verdict: TestQualityVerdictSchema,
  supportsBehaviorProof: z.boolean(),
  supportsTestClaim: z.boolean(),
  findings: z.array(TestQualityFindingSchema).min(1)
});

export const TestQualityFixtureCaseSchema = TestQualityAnalyzerInputSchema.extend({
  caseId: z.string().min(1),
  description: z.string().min(1),
  expectedVerdict: TestQualityVerdictSchema,
  expectedFindingIds: z.array(TestQualityFindingIdSchema).min(1),
  shouldCountAsStrong: z.boolean()
});

export const TestQualityFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(TestQualityFixtureCaseSchema).min(1)
});

export type TestQualityFindingId = z.infer<typeof TestQualityFindingIdSchema>;
export type TestQualityAnalyzerInput = z.input<typeof TestQualityAnalyzerInputSchema>;
export type ParsedTestQualityAnalyzerInput = z.infer<typeof TestQualityAnalyzerInputSchema>;
export type TestQualityAnalyzerResult = z.infer<typeof TestQualityAnalyzerResultSchema>;
export type TestQualityFixtureCase = z.infer<typeof TestQualityFixtureCaseSchema>;
