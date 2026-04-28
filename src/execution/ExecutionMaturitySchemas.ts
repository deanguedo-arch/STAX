import { z } from "zod";

export const ExecutionMaturityLevelSchema = z.enum([
  "level_0_answer_only",
  "level_1_evidence_request",
  "level_2_patch_plan",
  "level_3_sandbox_patch",
  "level_4_sandbox_verified",
  "level_5_human_approved_apply",
  "level_6_monitored_release"
]);

export const ExecutionMaturityInputSchema = z.object({
  hasEvidenceRequest: z.boolean().default(false),
  hasPatchPlan: z.boolean().default(false),
  sandboxPatchApplied: z.boolean().default(false),
  commandEvidencePassed: z.boolean().default(false),
  humanApprovedApply: z.boolean().default(false),
  releaseEvidence: z.boolean().default(false)
});

export const ExecutionMaturityResultSchema = z.object({
  currentLevel: ExecutionMaturityLevelSchema,
  nextLevel: ExecutionMaturityLevelSchema.optional(),
  needed: z.array(z.string()),
  blockingReasons: z.array(z.string())
});

export type ExecutionMaturityInput = z.input<typeof ExecutionMaturityInputSchema>;
export type ExecutionMaturityResult = z.infer<typeof ExecutionMaturityResultSchema>;
