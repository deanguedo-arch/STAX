import { z } from "zod";

export const ProblemBenchmarkWinnerSchema = z.enum([
  "stax_better",
  "external_better",
  "tie",
  "no_local_basis",
  "no_external_baseline"
]);

export const BenchmarkClaimLevelSchema = z.enum([
  "blind_first_pass",
  "post_correction_pass",
  "trained_slice_pass",
  "superiority_candidate"
]);

export const ProblemBenchmarkDimensionScoreSchema = z.object({
  actualAnswer: z.number().min(0).max(1),
  localSpecificity: z.number().min(0).max(1),
  commandSpecificity: z.number().min(0).max(1),
  boundedNextAction: z.number().min(0).max(1),
  proofHonesty: z.number().min(0).max(1),
  codexReadiness: z.number().min(0).max(1),
  riskControl: z.number().min(0).max(1),
  total: z.number().min(0).max(100)
});

export const ProblemBenchmarkCaseSchema = z.object({
  id: z.string().min(1),
  repo: z.string().min(1),
  workLane: z.string().min(1).optional(),
  taskFamily: z.string().min(1).optional(),
  blind: z.boolean().optional(),
  sourceContext: z.string().min(1).optional(),
  task: z.string().min(1),
  localEvidence: z.string().default(""),
  staxAnswer: z.string().min(1),
  staxAnswerSource: z.string().optional(),
  staxCapturedAt: z.string().optional(),
  externalAnswer: z.string().min(1),
  externalAnswerSource: z.string().optional(),
  externalCapturedAt: z.string().optional(),
  externalPrompt: z.string().optional(),
  expectedWinner: ProblemBenchmarkWinnerSchema.optional(),
  requiredQualities: z.array(z.string()).default([]),
  firstPassLocked: z.boolean().optional(),
  firstPassScoreRecorded: z.boolean().optional(),
  postCorrection: z.boolean().optional(),
  staxAnswerEditedAfterExternal: z.boolean().optional(),
  attemptedLockedFixtureOverwrite: z.boolean().optional(),
  lockedFixturePath: z.string().min(1).optional(),
  correctionCandidatePath: z.string().min(1).optional(),
  firstPassWinner: ProblemBenchmarkWinnerSchema.optional(),
  requestedClaimLevel: BenchmarkClaimLevelSchema.optional()
});

export const ProblemBenchmarkCollectionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1).optional(),
  stopCondition: z.string().optional(),
  staxAnswerSource: z.string().optional(),
  staxCapturedAt: z.string().optional(),
  externalAnswerSource: z.string().optional(),
  externalCapturedAt: z.string().optional(),
  externalPrompt: z.string().optional(),
  lockedFixturePath: z.string().min(1).optional(),
  lockedStaxFixture: z.string().min(1).optional(),
  postCorrection: z.boolean().optional(),
  correctionCandidatePath: z.string().min(1).optional(),
  cases: z.array(ProblemBenchmarkCaseSchema).min(1)
});

export const ProblemBenchmarkResultSchema = z.object({
  caseId: z.string().min(1),
  repo: z.string().min(1),
  winner: ProblemBenchmarkWinnerSchema,
  expectedWinner: ProblemBenchmarkWinnerSchema.optional(),
  matchedExpectedWinner: z.boolean().optional(),
  staxScore: ProblemBenchmarkDimensionScoreSchema,
  staxAnswerSource: z.string().optional(),
  staxCapturedAt: z.string().optional(),
  externalScore: ProblemBenchmarkDimensionScoreSchema,
  externalAnswerSource: z.string().optional(),
  externalCapturedAt: z.string().optional(),
  externalPrompt: z.string().optional(),
  reasons: z.array(z.string()),
  missingLocalEvidence: z.array(z.string()),
  externalBaselineGaps: z.array(z.string()),
  correctionCandidate: z.string().optional(),
  suggestedEval: z.string(),
  suggestedPromptPatch: z.string(),
  proofIntegrity: z.object({
    allowed: z.boolean(),
    claimLevel: BenchmarkClaimLevelSchema,
    firstPassEligible: z.boolean(),
    superiorityEligible: z.boolean(),
    reasons: z.array(z.string()),
    requiredLabel: BenchmarkClaimLevelSchema,
    lockedFixturePath: z.string().optional(),
    correctionCandidatePath: z.string().optional()
  })
});

export const ProblemBenchmarkSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  staxBetter: z.number().int().nonnegative(),
  externalBetter: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  noLocalBasis: z.number().int().nonnegative(),
  noExternalBaseline: z.number().int().nonnegative(),
  expectedMismatches: z.number().int().nonnegative(),
  confidence: z.enum(["not_proven", "promising", "benchmark_slice_proven"]),
  superiorityStatus: z.enum(["not_proven", "slice_only", "superiority_candidate"]),
  superiorityGaps: z.array(z.string()),
  proofIntegrityGaps: z.array(z.string()),
  continueLoopRequired: z.boolean(),
  stopConditionMet: z.boolean(),
  results: z.array(ProblemBenchmarkResultSchema)
});

export type ProblemBenchmarkWinner = z.infer<typeof ProblemBenchmarkWinnerSchema>;
export type BenchmarkClaimLevel = z.infer<typeof BenchmarkClaimLevelSchema>;
export type ProblemBenchmarkCase = z.infer<typeof ProblemBenchmarkCaseSchema>;
export type ProblemBenchmarkCollection = z.infer<typeof ProblemBenchmarkCollectionSchema>;
export type ProblemBenchmarkDimensionScore = z.infer<typeof ProblemBenchmarkDimensionScoreSchema>;
export type ProblemBenchmarkResult = z.infer<typeof ProblemBenchmarkResultSchema>;
export type ProblemBenchmarkSummary = z.infer<typeof ProblemBenchmarkSummarySchema>;
