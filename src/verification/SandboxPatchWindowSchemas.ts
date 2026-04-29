import { z } from "zod";
import { WorkPacketSchema } from "./VerificationEconomySchemas.js";

export const SandboxPatchWindowStatusSchema = z.enum([
  "approval_required",
  "blocked",
  "patched"
]);

export const SandboxPatchOperationSchema = z.object({
  filePath: z.string().min(1),
  content: z.string(),
  justification: z.string().min(1).optional()
});

export const SandboxPatchRunInputSchema = z.object({
  packet: WorkPacketSchema,
  operations: z.array(SandboxPatchOperationSchema).min(1),
  humanApprovedPatch: z.boolean().default(false),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  workspace: z.string().min(1).optional()
});

export const SandboxPatchChangedFileSchema = z.object({
  filePath: z.string().min(1),
  beforeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  afterHash: z.string().regex(/^[a-f0-9]{64}$/),
  beforeSizeBytes: z.number().int().nonnegative().optional(),
  afterSizeBytes: z.number().int().nonnegative(),
  created: z.boolean()
});

export const SandboxPatchEvidenceSchema = z.object({
  patchEvidenceId: z.string().min(1),
  packetId: z.string().min(1),
  workspace: z.string().min(1).optional(),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  changedFiles: z.array(SandboxPatchChangedFileSchema),
  diffPath: z.string().min(1),
  createdAt: z.string().datetime(),
  hash: z.string().regex(/^[a-f0-9]{64}$/)
});

export const SandboxPatchWindowResultSchema = z.object({
  status: SandboxPatchWindowStatusSchema,
  packetId: z.string().min(1),
  mutationStatus: z.enum(["none", "sandbox_only"]),
  changedFiles: z.array(SandboxPatchChangedFileSchema),
  patchEvidenceId: z.string().optional(),
  diffPath: z.string().optional(),
  manifestPath: z.string().optional(),
  postPatchRequiredCommands: z.array(z.string()),
  blockingReasons: z.array(z.string()),
  summary: z.string()
});

export type SandboxPatchOperation = z.input<typeof SandboxPatchOperationSchema>;
export type SandboxPatchRunInput = z.input<typeof SandboxPatchRunInputSchema>;
export type SandboxPatchChangedFile = z.infer<typeof SandboxPatchChangedFileSchema>;
export type SandboxPatchEvidence = z.infer<typeof SandboxPatchEvidenceSchema>;
export type SandboxPatchWindowResult = z.infer<typeof SandboxPatchWindowResultSchema>;
