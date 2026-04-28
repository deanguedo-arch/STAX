import { z } from "zod";

export const ExternalSourceTypeSchema = z.enum([
  "chatgpt-thread",
  "codex-report",
  "browser-chat",
  "manual-human-baseline",
  "other-model"
]);

export const ExternalSourceRecordSchema = z.object({
  caseId: z.string().min(1).optional(),
  sourceType: ExternalSourceTypeSchema.optional(),
  sourceId: z.string().min(1).optional(),
  captureContext: z.string().min(1).optional(),
  promptHash: z.string().min(1).optional(),
  countsAsNewSource: z.boolean().default(true)
});

export const ExternalSourceDiversityGateInputSchema = z.object({
  sources: z.array(ExternalSourceRecordSchema),
  minUniqueSources: z.number().int().positive().default(2)
});

export const ExternalSourceDiversityGateResultSchema = z.object({
  uniqueSourceCount: z.number().int().nonnegative(),
  uniqueContextCount: z.number().int().nonnegative(),
  status: z.enum(["single_source_slice", "source_diverse_eligible"]),
  blockingReasons: z.array(z.string()),
  duplicateSources: z.array(z.string()),
  sources: z.array(ExternalSourceRecordSchema.extend({
    canonicalSourceKey: z.string(),
    countsAsNewSource: z.boolean()
  }))
});

export type ExternalSourceType = z.infer<typeof ExternalSourceTypeSchema>;
export type ExternalSourceRecord = z.input<typeof ExternalSourceRecordSchema>;
export type ExternalSourceDiversityGateInput = z.input<typeof ExternalSourceDiversityGateInputSchema>;
export type ExternalSourceDiversityGateResult = z.infer<typeof ExternalSourceDiversityGateResultSchema>;
