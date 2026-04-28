import { z } from "zod";

export const SandboxGuardStatusSchema = z.enum(["approval_required", "blocked", "created", "verified"]);

export const SandboxGuardInputSchema = z.object({
  workspace: z.string().min(1).optional(),
  packetId: z.string().min(1).optional(),
  sourceRepoPath: z.string().min(1).optional(),
  sandboxPath: z.string().min(1),
  humanApprovedSandbox: z.boolean().default(false)
});

export const SandboxManifestSchema = z.object({
  sandboxId: z.string().min(1),
  workspace: z.string().min(1).optional(),
  packetId: z.string().min(1).optional(),
  sourceRepoPath: z.string().min(1),
  sandboxPath: z.string().min(1),
  createdAt: z.string().datetime(),
  copiedFiles: z.number().int().nonnegative(),
  skippedEntries: z.array(z.string()),
  guardVersion: z.literal("v0C")
});

export const SandboxGuardResultSchema = z.object({
  status: SandboxGuardStatusSchema,
  allowedForCommandWindow: z.boolean(),
  sourceRepoPath: z.string().optional(),
  sandboxPath: z.string(),
  manifestPath: z.string().optional(),
  copiedFiles: z.number().int().nonnegative().default(0),
  skippedEntries: z.array(z.string()).default([]),
  blockingReasons: z.array(z.string()),
  summary: z.string()
});

export type SandboxGuardInput = z.input<typeof SandboxGuardInputSchema>;
export type SandboxManifest = z.infer<typeof SandboxManifestSchema>;
export type SandboxGuardResult = z.infer<typeof SandboxGuardResultSchema>;
