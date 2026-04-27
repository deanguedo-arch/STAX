import { z } from "zod";

export const StrategicBenchmarkWinnerSchema = z.enum([
  "stax_better",
  "external_better",
  "tie",
  "no_external_baseline"
]);

export const StrategicBenchmarkScoreSchema = z.object({
  optionQuality: z.number().min(0).max(1),
  decisionClarity: z.number().min(0).max(1),
  tradeoffClarity: z.number().min(0).max(1),
  redTeamDepth: z.number().min(0).max(1),
  evidenceDiscipline: z.number().min(0).max(1),
  proofStep: z.number().min(0).max(1),
  killCriteria: z.number().min(0).max(1),
  providerHonesty: z.number().min(0).max(1),
  total: z.number().min(0).max(100)
});

export const StrategicBenchmarkCaseSchema = z.object({
  id: z.string().min(1),
  workLane: z.string().min(1),
  task: z.string().min(1),
  context: z.string().default(""),
  staxAnswer: z.string().min(1),
  externalAnswer: z.string().min(1),
  staxCapturedAt: z.string().optional(),
  externalCapturedAt: z.string().optional(),
  externalAnswerSource: z.string().optional(),
  expectedWinner: StrategicBenchmarkWinnerSchema.optional()
});

export const StrategicBenchmarkCollectionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().optional(),
  staxCapturedAt: z.string().optional(),
  externalCapturedAt: z.string().optional(),
  externalAnswerSource: z.string().optional(),
  cases: z.array(StrategicBenchmarkCaseSchema).min(1)
});

export const StrategicBenchmarkResultSchema = z.object({
  caseId: z.string().min(1),
  workLane: z.string().min(1),
  winner: StrategicBenchmarkWinnerSchema,
  expectedWinner: StrategicBenchmarkWinnerSchema.optional(),
  matchedExpectedWinner: z.boolean().optional(),
  staxScore: StrategicBenchmarkScoreSchema,
  externalScore: StrategicBenchmarkScoreSchema,
  externalBaselineIssues: z.array(z.string()).default([]),
  reasons: z.array(z.string()),
  correctionCandidate: z.string().optional()
});

export const StrategicBenchmarkSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  staxBetter: z.number().int().nonnegative(),
  externalBetter: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  noExternalBaseline: z.number().int().nonnegative(),
  expectedMismatches: z.number().int().nonnegative(),
  workLanes: z.number().int().nonnegative(),
  captureDates: z.number().int().nonnegative(),
  status: z.enum(["not_proven", "strategy_slice", "broad_reasoning_candidate"]),
  gaps: z.array(z.string()),
  results: z.array(StrategicBenchmarkResultSchema)
});

export type StrategicBenchmarkCase = z.infer<typeof StrategicBenchmarkCaseSchema>;
export type StrategicBenchmarkCollection = z.infer<typeof StrategicBenchmarkCollectionSchema>;
export type StrategicBenchmarkResult = z.infer<typeof StrategicBenchmarkResultSchema>;
export type StrategicBenchmarkScore = z.infer<typeof StrategicBenchmarkScoreSchema>;
export type StrategicBenchmarkSummary = z.infer<typeof StrategicBenchmarkSummarySchema>;
export type StrategicBenchmarkWinner = z.infer<typeof StrategicBenchmarkWinnerSchema>;
