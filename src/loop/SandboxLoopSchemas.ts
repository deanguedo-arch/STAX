import { z } from "zod";
import { HumanApplyPacketSchema } from "../execution/HumanApplyPacketSchemas.js";
import { PatchProofChainResultSchema } from "../verification/PatchProofChainSchemas.js";
import { SandboxPatchOperationSchema } from "../verification/SandboxPatchWindowSchemas.js";
import { WorkPacketSchema } from "../verification/VerificationEconomySchemas.js";

export const SandboxLoopModeSchema = z.enum([
  "dry_run",
  "sandbox_commands",
  "sandbox_patch"
]);

export const SandboxLoopStateSchema = z.enum([
  "planning",
  "sandbox_ready",
  "patch_attempted",
  "commands_running",
  "sandbox_verified",
  "blocked",
  "needs_human_decision",
  "failed",
  "done"
]);

export const LoopStopReasonSchema = z.enum([
  "none",
  "goal_verified",
  "forbidden_diff",
  "non_allowlisted_command",
  "failed_command",
  "same_next_step_repeated_3_times",
  "two_patch_failures",
  "needs_human_decision",
  "max_loops_reached"
]);

export const SandboxLoopBudgetSchema = z.object({
  maxLoops: z.number().int().positive().default(100),
  maxPatchAttempts: z.number().int().positive().default(3),
  maxCommands: z.number().int().positive().default(20),
  maxTouchedFiles: z.number().int().positive().default(3),
  maxConsecutiveFailures: z.number().int().positive().default(2)
});

const DefaultSandboxLoopBudget = {
  maxLoops: 100,
  maxPatchAttempts: 3,
  maxCommands: 20,
  maxTouchedFiles: 3,
  maxConsecutiveFailures: 2
};

export const LoopStopGateInputSchema = z.object({
  goalVerified: z.boolean().default(false),
  forbiddenDiff: z.boolean().default(false),
  nonAllowlistedCommand: z.boolean().default(false),
  failedCommand: z.boolean().default(false),
  plannedStepIds: z.array(z.string().min(1)).default([]),
  patchFailures: z.number().int().nonnegative().default(0),
  needsHumanDecision: z.boolean().default(false),
  loopCount: z.number().int().nonnegative().default(0),
  budget: SandboxLoopBudgetSchema.default(DefaultSandboxLoopBudget)
});

export const LoopStopGateResultSchema = z.object({
  shouldStop: z.boolean(),
  reason: LoopStopReasonSchema,
  summary: z.string()
});

export const LoopStateSnapshotSchema = z.object({
  state: SandboxLoopStateSchema,
  loopIndex: z.number().int().nonnegative(),
  summary: z.string(),
  stopReason: LoopStopReasonSchema.default("none")
});

export const SandboxLoopRunnerInputSchema = z.object({
  packet: WorkPacketSchema,
  mode: SandboxLoopModeSchema.default("dry_run"),
  workspace: z.string().min(1).optional(),
  sandboxPath: z.string().min(1),
  linkedRepoPath: z.string().min(1),
  humanApprovedPatch: z.boolean().default(false),
  humanApprovedCommandWindow: z.boolean().default(false),
  execute: z.boolean().default(false),
  operations: z.array(SandboxPatchOperationSchema).default([]),
  commands: z.array(z.string().min(1)).optional(),
  plannedStepIds: z.array(z.string().min(1)).default([]),
  patchFailureCount: z.number().int().nonnegative().default(0),
  budget: SandboxLoopBudgetSchema.default(DefaultSandboxLoopBudget)
});

export const SandboxLoopRunnerResultSchema = z.object({
  status: SandboxLoopStateSchema,
  mode: SandboxLoopModeSchema,
  loopsRun: z.number().int().nonnegative(),
  stopReason: LoopStopReasonSchema,
  states: z.array(LoopStateSnapshotSchema),
  chainResult: PatchProofChainResultSchema.optional(),
  applyPacket: HumanApplyPacketSchema.optional(),
  firstRemainingFailure: z.string().optional(),
  mutatedLinkedRepo: z.literal(false),
  summary: z.string()
});

export type SandboxLoopMode = z.infer<typeof SandboxLoopModeSchema>;
export type SandboxLoopState = z.infer<typeof SandboxLoopStateSchema>;
export type LoopStopReason = z.infer<typeof LoopStopReasonSchema>;
export type SandboxLoopBudget = z.input<typeof SandboxLoopBudgetSchema>;
export type LoopStopGateInput = z.input<typeof LoopStopGateInputSchema>;
export type LoopStopGateResult = z.infer<typeof LoopStopGateResultSchema>;
export type LoopStateSnapshot = z.infer<typeof LoopStateSnapshotSchema>;
export type SandboxLoopRunnerInput = z.input<typeof SandboxLoopRunnerInputSchema>;
export type SandboxLoopRunnerResult = z.infer<typeof SandboxLoopRunnerResultSchema>;
