import { z } from "zod";
import { CheckpointCommandEvidenceSchema, WorkPacketSchema } from "./VerificationEconomySchemas.js";

export const SandboxCommandWindowStatusSchema = z.enum([
  "approval_required",
  "blocked",
  "ready",
  "command_recorded",
  "stopped",
  "completed"
]);

export const SandboxCommandRunInputSchema = z.object({
  packet: WorkPacketSchema,
  commands: z.array(z.string().min(1)),
  humanApprovedWindow: z.boolean().default(false),
  execute: z.boolean().default(false),
  sandboxPath: z.string().min(1).optional(),
  linkedRepoPath: z.string().min(1).optional(),
  workspace: z.string().min(1).optional(),
  completedCommands: z.array(CheckpointCommandEvidenceSchema).default([])
});

export const SandboxCommandResultItemSchema = z.object({
  command: z.string().min(1),
  status: z.enum(["planned", "passed", "failed", "blocked", "skipped"]),
  exitCode: z.number().int().optional(),
  evidenceId: z.string().optional(),
  summary: z.string().optional()
});

export const SandboxCommandWindowResultSchema = z.object({
  status: SandboxCommandWindowStatusSchema,
  packetId: z.string(),
  execute: z.boolean(),
  mutationStatus: z.literal("none"),
  commandsPlanned: z.array(z.string()),
  commandsRun: z.array(z.string()),
  commandResults: z.array(SandboxCommandResultItemSchema),
  evidenceIds: z.array(z.string()),
  blockingReasons: z.array(z.string()),
  firstRemainingFailure: z.string().optional(),
  nextCheckpoint: z.string().optional(),
  summary: z.string()
});

export type SandboxCommandRunInput = z.input<typeof SandboxCommandRunInputSchema>;
export type SandboxCommandWindowResult = z.infer<typeof SandboxCommandWindowResultSchema>;
export type SandboxCommandResultItem = z.infer<typeof SandboxCommandResultItemSchema>;
