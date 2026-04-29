import { z } from "zod";
import { WorkPacketSchema } from "./VerificationEconomySchemas.js";
import { SandboxCommandResultItemSchema } from "./SandboxCommandWindowSchemas.js";

export const SandboxDependencyBootstrapStatusSchema = z.enum([
  "approval_required",
  "blocked",
  "ready",
  "bootstrapped",
  "stopped"
]);

export const SandboxDependencyBootstrapInputSchema = z.object({
  packet: WorkPacketSchema,
  workspace: z.string().min(1).optional(),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  humanApprovedBootstrap: z.boolean().default(false),
  execute: z.boolean().default(false),
  repairLockfile: z.boolean().default(false),
  commands: z.array(z.string().min(1)).optional()
});

export const SandboxDependencyBootstrapResultSchema = z.object({
  status: SandboxDependencyBootstrapStatusSchema,
  packetId: z.string().min(1),
  execute: z.boolean(),
  commandsPlanned: z.array(z.string()),
  commandsRun: z.array(z.string()),
  commandResults: z.array(SandboxCommandResultItemSchema),
  evidenceIds: z.array(z.string()),
  manifestRefreshed: z.boolean(),
  changedFiles: z.array(z.string()),
  blockingReasons: z.array(z.string()),
  firstRemainingFailure: z.string().optional(),
  nextStep: z.string().optional(),
  summary: z.string()
});

export type SandboxDependencyBootstrapInput = z.input<typeof SandboxDependencyBootstrapInputSchema>;
export type SandboxDependencyBootstrapResult = z.infer<typeof SandboxDependencyBootstrapResultSchema>;
export type SandboxDependencyBootstrapStatus = z.infer<typeof SandboxDependencyBootstrapStatusSchema>;
