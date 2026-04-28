import { z } from "zod";

export const HoldoutTaskFamilySchema = z.enum([
  "command_contract",
  "proof_boundary",
  "visual_evidence",
  "runtime_evidence",
  "content_precedence",
  "deployment_boundary",
  "baseline_drift",
  "strategy",
  "human_judgment",
  "execution_maturity"
]);

export const HoldoutFreshnessCaseSchema = z.object({
  id: z.string().min(1),
  repo: z.string().min(1),
  task: z.string().min(1),
  taskFamily: HoldoutTaskFamilySchema.optional(),
  proofBoundary: z.string().min(1).optional(),
  externalSource: z.string().min(1).optional(),
  externalAnswerSource: z.string().min(1).optional(),
  externalCapturedAt: z.string().min(1).optional(),
  captureDate: z.string().min(1).optional(),
  localEvidence: z.string().default(""),
  sourceContext: z.string().min(1).optional()
});

export const HoldoutFreshnessInputSchema = z.object({
  candidate: HoldoutFreshnessCaseSchema,
  existingCases: z.array(HoldoutFreshnessCaseSchema).default([]),
  requireLocalEvidence: z.boolean().default(true),
  rejectRecycledExternalBaseline: z.boolean().default(true)
});

export const HoldoutFreshnessResultSchema = z.object({
  caseId: z.string().min(1),
  repo: z.string().min(1),
  taskFamily: HoldoutTaskFamilySchema,
  proofBoundary: z.string().min(1),
  externalSource: z.string().optional(),
  captureDate: z.string().optional(),
  similarityToExistingCases: z.array(z.object({
    caseId: z.string().min(1),
    similarity: z.number().min(0).max(1),
    sameRepo: z.boolean(),
    sameTaskFamily: z.boolean(),
    sameProofBoundary: z.boolean()
  })),
  isFresh: z.boolean(),
  freshnessReasons: z.array(z.string()),
  blockingReasons: z.array(z.string())
});

export type HoldoutTaskFamily = z.infer<typeof HoldoutTaskFamilySchema>;
export type HoldoutFreshnessCase = z.input<typeof HoldoutFreshnessCaseSchema>;
export type HoldoutFreshnessInput = z.input<typeof HoldoutFreshnessInputSchema>;
export type HoldoutFreshnessResult = z.infer<typeof HoldoutFreshnessResultSchema>;
