import { z } from "zod";
import { ProblemBenchmarkWinnerSchema } from "./ProblemBenchmarkSchemas.js";

export const BenchmarkClaimLevelSchema = z.enum([
  "blind_first_pass",
  "post_correction_pass",
  "trained_slice_pass",
  "superiority_candidate"
]);

export const FirstPassIntegrityInputSchema = z.object({
  fixtureId: z.string().min(1),
  firstPassLocked: z.boolean().default(false),
  firstPassScoreRecorded: z.boolean().default(false),
  postCorrection: z.boolean().default(false),
  staxAnswerEditedAfterExternal: z.boolean().default(false),
  attemptedLockedFixtureOverwrite: z.boolean().default(false),
  lockedFixturePath: z.string().min(1).optional(),
  correctionCandidatePath: z.string().min(1).optional(),
  firstPassWinner: ProblemBenchmarkWinnerSchema.optional(),
  currentWinner: ProblemBenchmarkWinnerSchema.optional(),
  requestedClaimLevel: BenchmarkClaimLevelSchema.optional()
});

export const FirstPassIntegrityResultSchema = z.object({
  fixtureId: z.string().min(1),
  allowed: z.boolean(),
  claimLevel: BenchmarkClaimLevelSchema,
  firstPassEligible: z.boolean(),
  superiorityEligible: z.boolean(),
  reasons: z.array(z.string()),
  requiredLabel: BenchmarkClaimLevelSchema,
  lockedFixturePath: z.string().optional(),
  correctionCandidatePath: z.string().optional()
});

export type BenchmarkClaimLevel = z.infer<typeof BenchmarkClaimLevelSchema>;
export type FirstPassIntegrityInput = z.input<typeof FirstPassIntegrityInputSchema>;
export type FirstPassIntegrityResult = z.infer<typeof FirstPassIntegrityResultSchema>;
