import { z } from "zod";
import {
  OperationExecutionClassSchema,
  OperationIntentSchema,
  OperationRiskLevelSchema
} from "./OperationSchemas.js";

export const ProblemMovementDispositionSchema = z.enum([
  "moved_problem",
  "needs_evidence",
  "human_choice_required",
  "blocked",
  "deferred",
  "failed_to_move"
]);

export const ProblemMovementInputSchema = z.object({
  userTask: z.string().min(1),
  intent: OperationIntentSchema,
  reasonCodes: z.array(z.string()).default([]),
  riskLevel: OperationRiskLevelSchema,
  executionClass: OperationExecutionClassSchema,
  directAnswer: z.string(),
  oneNextStep: z.string(),
  whyThisStep: z.string(),
  proofStatus: z.string(),
  receiptStatus: z.enum(["executed", "blocked", "deferred", "not_executed"]),
  evidenceRequired: z.array(z.string()).default([]),
  evidenceChecked: z.array(z.string()).default([]),
  artifactsCreated: z.array(z.string()).default([]),
  claimsVerified: z.array(z.string()).default([]),
  claimsNotVerified: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  fakeCompleteRisks: z.array(z.string()).default([]),
  nextAllowedActions: z.array(z.string()).default([]),
  mutationStatus: z.string(),
  promotionStatus: z.string()
});

export const ProblemMovementResultSchema = z.object({
  valid: z.boolean(),
  disposition: ProblemMovementDispositionSchema,
  movesProblemForward: z.boolean(),
  statedProblem: z.string(),
  movementMade: z.string(),
  remainingRisk: z.string(),
  requiredEvidence: z.array(z.string()),
  nextAllowedAction: z.string(),
  blockingReasons: z.array(z.string()),
  requiredRewrite: z.string().optional()
});

export type ProblemMovementDisposition = z.infer<typeof ProblemMovementDispositionSchema>;
export type ProblemMovementInput = z.infer<typeof ProblemMovementInputSchema>;
export type ProblemMovementResult = z.infer<typeof ProblemMovementResultSchema>;
