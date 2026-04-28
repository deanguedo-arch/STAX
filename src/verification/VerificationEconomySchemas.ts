import { z } from "zod";

export const VerificationDecisionSchema = z.enum([
  "auto_continue",
  "checkpoint_required",
  "approval_required",
  "hard_stop",
  "done"
]);

export const VerificationTierSchema = z.enum([
  "tier_0_none",
  "tier_1_structural",
  "tier_2_targeted_command",
  "tier_3_full_gate",
  "tier_4_human_judgment"
]);

export const MicroStepKindSchema = z.enum([
  "read_only_inspection",
  "evidence_classification",
  "structural_check",
  "prompt_drafting",
  "summary",
  "targeted_command",
  "full_gate_command",
  "dependency_repair",
  "sandbox_patching",
  "file_mutation",
  "scope_expansion",
  "human_judgment",
  "goal_verification"
]);

export const CheckpointTriggerSchema = z.enum([
  "file_change",
  "failed_command",
  "max_micro_steps",
  "goal_verified",
  "proof_recorded"
]);

export const AutonomyWindowModeSchema = z.enum(["plan_only", "sandbox_patch"]);

export const MicroStepSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  kind: MicroStepKindSchema,
  command: z.string().min(1).optional(),
  files: z.array(z.string()).default([]),
  exitCode: z.number().int().optional(),
  passed: z.boolean().optional()
});

export const AutonomyWindowSchema = z.object({
  mode: AutonomyWindowModeSchema.default("plan_only"),
  humanApprovedWindow: z.boolean().default(false),
  maxMicroSteps: z.number().int().positive().default(10),
  maxTouchedFiles: z.number().int().nonnegative().default(2),
  maxCommands: z.number().int().nonnegative().default(4),
  maxConsecutiveFailures: z.number().int().positive().default(1),
  allowedCommands: z.array(z.string()).default([]),
  allowedFileGlobs: z.array(z.string()).default([]),
  forbiddenFileGlobs: z.array(z.string()).default([]),
  hardBlockedCommands: z.array(z.string()).default([]),
  checkpointRequiredAfter: z.array(CheckpointTriggerSchema).default(["file_change", "failed_command", "max_micro_steps", "goal_verified"])
});

export const WorkPacketSchema = z.object({
  packetId: z.string().min(1),
  macroGoal: z.string().min(1),
  workspace: z.string().min(1).optional(),
  repoPath: z.string().min(1).optional(),
  mode: AutonomyWindowModeSchema.default("plan_only"),
  autoContinueSteps: z.array(MicroStepSchema),
  approvalRequiredSteps: z.array(MicroStepSchema).default([]),
  allowedAfterApproval: z.array(z.string()).default([]),
  allowedCommands: z.array(z.string()).default([]),
  allowedFileGlobs: z.array(z.string()).default([]),
  forbiddenFileGlobs: z.array(z.string()).default([]),
  hardBlockedCommands: z.array(z.string()).default([]),
  hardStops: z.array(z.string()).default([]),
  checkpointCommands: z.array(z.string()).default([]),
  stopConditions: z.array(z.string()).default([]),
  autonomyWindow: AutonomyWindowSchema.optional()
});

export const AutoAdvanceGateInputSchema = z.object({
  packet: WorkPacketSchema,
  step: MicroStepSchema,
  window: AutonomyWindowSchema.optional(),
  completedSteps: z.array(MicroStepSchema).default([])
});

export const AutoAdvanceGateResultSchema = z.object({
  decision: VerificationDecisionSchema,
  verificationTier: VerificationTierSchema,
  requiresHumanNow: z.boolean(),
  verificationRequiredNow: z.boolean(),
  checkpointGroup: z.string(),
  nextCheckpoint: z.string().optional(),
  firstRealBoundary: z.string().optional(),
  firstRemainingFailure: z.string().optional(),
  hardStopReason: z.string().optional(),
  riskIfDeferred: z.enum(["none", "low", "medium", "high"]).default("low"),
  reasons: z.array(z.string())
});

export const CheckpointCommandEvidenceSchema = z.object({
  command: z.string().min(1),
  exitCode: z.number().int(),
  summary: z.string().optional()
});

export const CheckpointGateInputSchema = z.object({
  packet: WorkPacketSchema,
  command: z.string().min(1).optional(),
  exitCode: z.number().int().optional(),
  completedCommands: z.array(CheckpointCommandEvidenceSchema).default([])
});

export const CheckpointGateResultSchema = z.object({
  decision: VerificationDecisionSchema,
  verificationTier: VerificationTierSchema,
  verificationRequiredNow: z.boolean(),
  firstRemainingFailure: z.string().optional(),
  nextCheckpoint: z.string().optional(),
  reasons: z.array(z.string())
});

export const AutoAdvanceReportSchema = z.object({
  packetId: z.string(),
  autoAdvanced: z.array(z.string()),
  firstRealBoundary: z.string(),
  proposedAuthorizedWindow: z.object({
    allowedCommands: z.array(z.string()),
    allowedFiles: z.array(z.string()),
    allowedAfterApproval: z.array(z.string())
  }),
  hardStops: z.array(z.string()),
  decisionNeeded: z.string()
});

export type VerificationDecision = z.infer<typeof VerificationDecisionSchema>;
export type VerificationTier = z.infer<typeof VerificationTierSchema>;
export type MicroStepKind = z.infer<typeof MicroStepKindSchema>;
export type MicroStep = z.input<typeof MicroStepSchema>;
export type ParsedMicroStep = z.infer<typeof MicroStepSchema>;
export type AutonomyWindow = z.input<typeof AutonomyWindowSchema>;
export type ParsedAutonomyWindow = z.infer<typeof AutonomyWindowSchema>;
export type WorkPacket = z.input<typeof WorkPacketSchema>;
export type ParsedWorkPacket = z.infer<typeof WorkPacketSchema>;
export type AutoAdvanceGateInput = z.input<typeof AutoAdvanceGateInputSchema>;
export type AutoAdvanceGateResult = z.infer<typeof AutoAdvanceGateResultSchema>;
export type CheckpointCommandEvidence = z.input<typeof CheckpointCommandEvidenceSchema>;
export type CheckpointGateInput = z.input<typeof CheckpointGateInputSchema>;
export type CheckpointGateResult = z.infer<typeof CheckpointGateResultSchema>;
export type AutoAdvanceReport = z.infer<typeof AutoAdvanceReportSchema>;
