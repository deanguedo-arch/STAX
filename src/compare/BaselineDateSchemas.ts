import { z } from "zod";

export const BaselineDateRecordSchema = z.object({
  caseId: z.string().min(1),
  externalCapturedAt: z.string().min(1).optional(),
  externalAnswerSource: z.string().min(1).optional(),
  captureContext: z.string().min(1).optional(),
  promptHash: z.string().min(1).optional(),
  externalAnswerHash: z.string().min(1).optional(),
  duplicated: z.boolean().optional()
});

export const BaselineDateGateInputSchema = z.object({
  records: z.array(BaselineDateRecordSchema),
  minUniqueDates: z.number().int().positive().default(2),
  now: z.string().datetime().optional(),
  staleAfterDays: z.number().int().positive().default(90)
});

export const BaselineDateGateResultSchema = z.object({
  captureDates: z.array(z.string()),
  uniqueDateCount: z.number().int().nonnegative(),
  status: z.enum(["one_day_slice", "multi_day_eligible"]),
  blockingReasons: z.array(z.string()),
  warnings: z.array(z.string()),
  ignoredDuplicates: z.array(z.string())
});

export type BaselineDateRecord = z.input<typeof BaselineDateRecordSchema>;
export type BaselineDateGateInput = z.input<typeof BaselineDateGateInputSchema>;
export type BaselineDateGateResult = z.infer<typeof BaselineDateGateResultSchema>;
