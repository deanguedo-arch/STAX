import { z } from "zod";

export const ExternalBaselineImportInputSchema = z.object({
  caseId: z.string().min(1),
  externalAnswer: z.string().min(1),
  externalAnswerSource: z.string().min(1).optional(),
  externalCapturedAt: z.string().min(1).optional(),
  externalPrompt: z.string().min(1).optional(),
  captureContext: z.string().min(1).optional(),
  humanConfirmedNotDrifted: z.boolean().optional(),
  task: z.string().min(1).optional(),
  staxAnswer: z.string().optional(),
  localEvidence: z.string().optional()
});

export const ExternalBaselineImportResultSchema = z.object({
  caseId: z.string().min(1),
  externalBaselineValid: z.boolean(),
  metadataValid: z.boolean(),
  contentValid: z.boolean(),
  blockingReasons: z.array(z.string()),
  warnings: z.array(z.string()),
  normalized: z.object({
    externalAnswerSource: z.string().optional(),
    externalCapturedAt: z.string().optional(),
    externalPrompt: z.string().optional(),
    captureContext: z.string().optional(),
    answerHash: z.string()
  })
});

export type ExternalBaselineImportInput = z.input<typeof ExternalBaselineImportInputSchema>;
export type ExternalBaselineImportResult = z.infer<typeof ExternalBaselineImportResultSchema>;
