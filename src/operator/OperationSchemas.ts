import { z } from "zod";

export const CHAT_OPERATOR_VERSION = "v1B";

export const OperationIntentSchema = z.enum([
  "audit_workspace",
  "workspace_repo_audit",
  "codex_report_audit",
  "judgment_digest",
  "audit_last_proof",
  "unknown"
]);

export const OperationRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const OperationExecutionClassSchema = z.enum([
  "read_only",
  "low_risk_artifact_creating",
  "requires_confirmation",
  "review_only",
  "hard_block",
  "fallback"
]);

export const OperationPlanSchema = z.object({
  operationId: z.string().min(1),
  operatorVersion: z.literal(CHAT_OPERATOR_VERSION),
  intent: OperationIntentSchema,
  originalInput: z.string().min(1),
  workspace: z.string().optional(),
  repoPath: z.string().optional(),
  objective: z.string().min(1),
  operationsToRun: z.array(z.string()),
  riskLevel: OperationRiskLevelSchema,
  executionClass: OperationExecutionClassSchema,
  requiresConfirmation: z.boolean(),
  evidenceRequired: z.array(z.string()),
  outputContract: z.array(z.string()),
  reasonCodes: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"])
});

export const OperationExecutionResultSchema = z.object({
  executed: z.boolean(),
  blocked: z.boolean(),
  deferred: z.boolean(),
  actionsRun: z.array(z.string()),
  artifactsCreated: z.array(z.string()),
  evidenceChecked: z.array(z.string()),
  result: z.string(),
  risks: z.array(z.string()),
  nextAllowedActions: z.array(z.string())
});

export type OperationIntent = z.infer<typeof OperationIntentSchema>;
export type OperationRiskLevel = z.infer<typeof OperationRiskLevelSchema>;
export type OperationExecutionClass = z.infer<typeof OperationExecutionClassSchema>;
export type OperationPlan = z.infer<typeof OperationPlanSchema>;
export type OperationExecutionResult = z.infer<typeof OperationExecutionResultSchema>;
