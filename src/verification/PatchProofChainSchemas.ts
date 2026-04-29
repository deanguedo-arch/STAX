import { z } from "zod";
import { HumanApplyPacketSchema } from "../execution/HumanApplyPacketSchemas.js";
import { SandboxCommandResultItemSchema } from "./SandboxCommandWindowSchemas.js";
import { SandboxPatchChangedFileSchema, SandboxPatchOperationSchema } from "./SandboxPatchWindowSchemas.js";
import { CheckpointCommandEvidenceSchema, WorkPacketSchema } from "./VerificationEconomySchemas.js";

export const PatchProofChainStatusSchema = z.enum([
  "sandbox_verified",
  "sandbox_failed",
  "blocked",
  "needs_human_apply_decision"
]);

export const PatchProofChainInputSchema = z.object({
  packet: WorkPacketSchema,
  workspace: z.string().min(1).optional(),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  humanApprovedPatch: z.boolean().default(false),
  humanApprovedCommandWindow: z.boolean().default(false),
  execute: z.boolean().default(true),
  operations: z.array(SandboxPatchOperationSchema).default([]),
  commands: z.array(z.string().min(1)).optional(),
  completedCommands: z.array(CheckpointCommandEvidenceSchema).default([])
});

export const PatchProofChainResultSchema = z.object({
  status: PatchProofChainStatusSchema,
  packetId: z.string().min(1),
  patchDiffPath: z.string().optional(),
  patchEvidenceId: z.string().optional(),
  commandsRun: z.array(z.string()),
  commandResults: z.array(SandboxCommandResultItemSchema),
  evidenceIds: z.array(z.string()),
  firstRemainingFailure: z.string().optional(),
  changedFiles: z.array(SandboxPatchChangedFileSchema),
  applyRecommendation: z.enum(["apply", "do_not_apply", "needs_review"]),
  applyPacket: HumanApplyPacketSchema,
  blockingReasons: z.array(z.string()),
  summary: z.string()
});

export type PatchProofChainStatus = z.infer<typeof PatchProofChainStatusSchema>;
export type PatchProofChainInput = z.input<typeof PatchProofChainInputSchema>;
export type PatchProofChainResult = z.infer<typeof PatchProofChainResultSchema>;
