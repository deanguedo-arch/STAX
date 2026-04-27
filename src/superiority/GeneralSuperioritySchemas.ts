import { z } from "zod";
import { ProblemBenchmarkResultSchema, ProblemBenchmarkSummarySchema } from "../compare/ProblemBenchmarkSchemas.js";

export const GeneralSuperiorityStatusSchema = z.enum([
  "not_proven",
  "campaign_slice",
  "superiority_candidate"
]);

export const GeneralSuperiorityThresholdsSchema = z.object({
  minComparisons: z.number().int().positive().default(250),
  minBlindComparisons: z.number().int().nonnegative().default(250),
  minWorkLanes: z.number().int().positive().default(12),
  minTaskFamilies: z.number().int().positive().default(12),
  minReposOrDomains: z.number().int().positive().default(7),
  minExternalSources: z.number().int().positive().default(2),
  minCaptureDates: z.number().int().positive().default(3)
});

export const GeneralSuperiorityMetricsSchema = z.object({
  comparisons: z.number().int().nonnegative(),
  blindComparisons: z.number().int().nonnegative(),
  workLanes: z.number().int().nonnegative(),
  taskFamilies: z.number().int().nonnegative(),
  reposOrDomains: z.number().int().nonnegative(),
  externalSources: z.number().int().nonnegative(),
  captureDates: z.number().int().nonnegative(),
  externalBetter: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  noLocalBasis: z.number().int().nonnegative(),
  noExternalBaseline: z.number().int().nonnegative(),
  expectedMismatches: z.number().int().nonnegative()
});

export const GeneralSuperiorityReportSchema = z.object({
  target: z.literal("general_superiority"),
  status: GeneralSuperiorityStatusSchema,
  createdAt: z.string().min(1),
  thresholds: GeneralSuperiorityThresholdsSchema,
  metrics: GeneralSuperiorityMetricsSchema,
  benchmarkSummary: ProblemBenchmarkSummarySchema,
  gaps: z.array(z.string()),
  nextActions: z.array(z.string()),
  nonWinningCases: z.array(ProblemBenchmarkResultSchema),
  workLanesCovered: z.array(z.string()),
  taskFamiliesCovered: z.array(z.string()),
  externalSourcesCovered: z.array(z.string()),
  captureDatesCovered: z.array(z.string())
});

export type GeneralSuperiorityStatus = z.infer<typeof GeneralSuperiorityStatusSchema>;
export type GeneralSuperiorityThresholds = z.infer<typeof GeneralSuperiorityThresholdsSchema>;
export type GeneralSuperiorityMetrics = z.infer<typeof GeneralSuperiorityMetricsSchema>;
export type GeneralSuperiorityReport = z.infer<typeof GeneralSuperiorityReportSchema>;
