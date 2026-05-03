import { z } from "zod";

export const DataPipelineProofVerdictSchema = z.enum(["accept", "provisional", "reject"]);

export const DataPipelineProofFindingIdSchema = z.enum([
  "validation_present",
  "dry_run_present",
  "row_count_present",
  "example_config_only",
  "missing_dry_run",
  "missing_validation",
  "missing_row_count_diff",
  "duplicate_rows_detected",
  "unknown_fields_detected",
  "suspicious_blank_rates"
]);

export const DataPipelineProofFindingSchema = z.object({
  id: DataPipelineProofFindingIdSchema,
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string().min(1)
});

export const DataPipelineProofAnalyzerInputSchema = z.object({
  caseId: z.string().optional(),
  task: z.string().default(""),
  description: z.string().default(""),
  source: z.enum(["dry_run", "validation_script", "row_count_report", "config_check", "review_queue"]).default("validation_script"),
  capturedAt: z.string().datetime().optional(),
  rowCountBefore: z.number().int().nonnegative().optional(),
  rowCountAfter: z.number().int().nonnegative().optional(),
  duplicateCount: z.number().int().nonnegative().optional(),
  unknownFieldCount: z.number().int().nonnegative().optional(),
  blankRateNotes: z.string().optional(),
  dryRunPassed: z.boolean().optional(),
  validationPassed: z.boolean().optional(),
  configPath: z.string().optional(),
  configKind: z.enum(["live", "example"]).optional()
});

export const DataPipelineProofAnalyzerResultSchema = z.object({
  verdict: DataPipelineProofVerdictSchema,
  findings: z.array(DataPipelineProofFindingSchema).min(1),
  supportsDataClaim: z.boolean()
});

export const DataPipelineProofFixtureCaseSchema = DataPipelineProofAnalyzerInputSchema.extend({
  caseId: z.string().min(1),
  descriptionLabel: z.string().min(1),
  expectedVerdict: DataPipelineProofVerdictSchema,
  expectedFindingIds: z.array(DataPipelineProofFindingIdSchema).min(1),
  shouldCountAsStrong: z.boolean()
});

export const DataPipelineProofFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(DataPipelineProofFixtureCaseSchema).min(1)
});

export type DataPipelineProofAnalyzerInput = z.input<typeof DataPipelineProofAnalyzerInputSchema>;
export type DataPipelineProofAnalyzerResult = z.infer<typeof DataPipelineProofAnalyzerResultSchema>;
export type DataPipelineProofFixtureCase = z.infer<typeof DataPipelineProofFixtureCaseSchema>;
export type DataPipelineProofFindingId = z.infer<typeof DataPipelineProofFindingIdSchema>;
