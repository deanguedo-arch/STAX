import { z } from "zod";

export const LearningFailureTypeSchema = z.enum([
  "generic_output",
  "missing_specificity",
  "missing_tests",
  "missing_files",
  "weak_plan",
  "unsupported_claim",
  "schema_failure",
  "critic_failure",
  "mode_mismatch",
  "policy_gap",
  "memory_gap",
  "eval_gap",
  "correction_needed",
  "training_candidate",
  "tool_gap",
  "fake_complete_risk",
  "eval_failure",
  "command_failure",
  "promotion_failure",
  "replay_drift",
  "provider_role_mismatch"
]);

export const LearningQueueTypeSchema = z.enum([
  "trace_only",
  "correction_candidate",
  "eval_candidate",
  "memory_candidate",
  "training_candidate",
  "policy_patch_candidate",
  "schema_patch_candidate",
  "mode_contract_patch_candidate",
  "codex_prompt_candidate"
]);

export const LearningApprovalStateSchema = z.enum([
  "trace_only",
  "pending_review",
  "approved",
  "rejected"
]);

export const LearningEventStatusSchema = z.enum([
  "success",
  "critic_failure",
  "schema_failure",
  "refusal",
  "tool_failure",
  "eval_failure",
  "replay_failure",
  "command_failure",
  "promotion_failure"
]);

export const LearningQualitySignalsSchema = z.object({
  genericOutputScore: z.number().min(0).max(1),
  specificityScore: z.number().min(0).max(1),
  actionabilityScore: z.number().min(0).max(1),
  evidenceScore: z.number().min(0).max(1),
  missingSections: z.array(z.string()),
  forbiddenPatterns: z.array(z.string()),
  unsupportedClaims: z.array(z.string())
});

export const LearningEventSchema = z.object({
  eventId: z.string().min(1),
  runId: z.string().min(1),
  commandId: z.string().optional(),
  threadId: z.string().optional(),
  workspace: z.string().optional(),
  createdAt: z.string().min(1),
  command: z
    .object({
      name: z.string(),
      argsSummary: z.string(),
      exitStatus: z.number().optional(),
      success: z.boolean(),
      outputSummary: z.string(),
      artifactPaths: z.array(z.string())
    })
    .optional(),
  input: z.object({
    raw: z.string(),
    normalized: z.string().optional(),
    summary: z.string()
  }),
  output: z.object({
    raw: z.string(),
    summary: z.string(),
    mode: z.string(),
    schemaValid: z.boolean(),
    criticPassed: z.boolean(),
    repairAttempted: z.boolean(),
    finalStatus: LearningEventStatusSchema
  }),
  routing: z.object({
    detectedMode: z.string(),
    modeConfidence: z.number(),
    selectedAgent: z.string(),
    policiesApplied: z.array(z.string()),
    providerRoles: z.record(z.string(), z.string())
  }),
  commands: z.object({
    commandName: z.string().optional(),
    argsSummary: z.string().optional(),
    success: z.boolean().optional(),
    exitCode: z.number().optional(),
    requested: z.array(z.string()),
    allowed: z.array(z.string()),
    denied: z.array(z.string())
  }),
  qualitySignals: LearningQualitySignalsSchema,
  failureClassification: z.object({
    hasFailure: z.boolean(),
    failureTypes: z.array(LearningFailureTypeSchema),
    severity: z.enum(["none", "minor", "major", "critical"]),
    explanation: z.string()
  }),
  proposedQueues: z.array(LearningQueueTypeSchema),
  approvalState: LearningApprovalStateSchema,
  links: z.object({
    tracePath: z.string(),
    finalPath: z.string(),
    criticPath: z.string().optional(),
    repairPath: z.string().optional(),
    evalResultPath: z.string().optional()
  })
});

export const LearningQueueItemSchema = z.object({
  queueItemId: z.string().min(1),
  eventId: z.string().min(1),
  runId: z.string().min(1),
  commandId: z.string().optional(),
  queueType: LearningQueueTypeSchema,
  reason: z.string().min(1),
  sourceTracePath: z.string().min(1),
  sourceFinalPath: z.string().min(1),
  createdAt: z.string().min(1),
  approvalState: z.literal("pending_review"),
  proposedArtifact: z.string().optional()
});

export const LearningProposalSchema = z.object({
  proposalId: z.string().min(1),
  eventId: z.string().min(1),
  runId: z.string().min(1),
  queueTypes: z.array(LearningQueueTypeSchema),
  createdAt: z.string().min(1),
  path: z.string().min(1),
  approvalRequired: z.literal(true),
  unsafeInstructionsFlagged: z.array(z.string())
});

export type LearningFailureType = z.infer<typeof LearningFailureTypeSchema>;
export type LearningQueueType = z.infer<typeof LearningQueueTypeSchema>;
export type LearningApprovalState = z.infer<typeof LearningApprovalStateSchema>;
export type LearningEventStatus = z.infer<typeof LearningEventStatusSchema>;
export type LearningQualitySignals = z.infer<typeof LearningQualitySignalsSchema>;
export type LearningEvent = z.infer<typeof LearningEventSchema>;
export type LearningQueueItem = z.infer<typeof LearningQueueItemSchema>;
export type LearningProposal = z.infer<typeof LearningProposalSchema>;
