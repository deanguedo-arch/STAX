import { z } from "zod";
import { SandboxPatchChangedFileSchema } from "../verification/SandboxPatchWindowSchemas.js";
import { SandboxCommandResultItemSchema } from "../verification/SandboxCommandWindowSchemas.js";

export const HumanApplyPacketStatusSchema = z.enum([
  "sandbox_verified",
  "sandbox_failed",
  "blocked"
]);

export const HumanApplyRecommendationSchema = z.enum([
  "apply",
  "do_not_apply",
  "needs_review"
]);

export const HumanApplyPacketInputSchema = z.object({
  status: HumanApplyPacketStatusSchema,
  packetId: z.string().min(1),
  workspace: z.string().min(1).optional(),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  changedFiles: z.array(SandboxPatchChangedFileSchema).default([]),
  patchDiffPath: z.string().min(1).optional(),
  patchEvidenceId: z.string().min(1).optional(),
  commandResults: z.array(SandboxCommandResultItemSchema).default([]),
  commandEvidenceIds: z.array(z.string().min(1)).default([]),
  firstRemainingFailure: z.string().min(1).optional(),
  blockingReasons: z.array(z.string()).default([]),
  forbiddenDiff: z.boolean().default(false),
  missingCommandEvidence: z.boolean().default(false)
});

export const HumanApplyPacketSchema = z.object({
  status: HumanApplyPacketStatusSchema,
  packetId: z.string().min(1),
  workspace: z.string().min(1).optional(),
  recommendation: HumanApplyRecommendationSchema,
  requiresHumanApproval: z.literal(true),
  appliedToRealRepo: z.literal(false),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  changedFiles: z.array(SandboxPatchChangedFileSchema),
  patchDiffPath: z.string().min(1).optional(),
  patchEvidenceId: z.string().min(1).optional(),
  commandResults: z.array(SandboxCommandResultItemSchema),
  commandEvidenceIds: z.array(z.string().min(1)),
  firstRemainingFailure: z.string().optional(),
  blockingReasons: z.array(z.string()),
  risks: z.array(z.string()),
  markdown: z.string().min(1)
});

export type HumanApplyPacketInput = z.input<typeof HumanApplyPacketInputSchema>;
export type HumanApplyPacket = z.infer<typeof HumanApplyPacketSchema>;
export type HumanApplyRecommendation = z.infer<typeof HumanApplyRecommendationSchema>;
