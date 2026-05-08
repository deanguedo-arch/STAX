import { z } from "zod";
import { LearningFailureTypeSchema, LearningQueueTypeSchema } from "./LearningEvent.js";

export const PatternPromotionClassificationSchema = z.enum([
  "trace_fact",
  "repo_specific_fact",
  "cross_repo_pattern",
  "proof_boundary_rule",
  "codex_handoff_rule",
  "mode_behavior_rule",
  "policy_safety_rule",
  "schema_contract_rule",
  "user_preference"
]);

export const PatternPromotionTargetSchema = z.enum([
  "correction",
  "eval",
  "memory",
  "training",
  "policy_patch",
  "schema_patch",
  "mode_contract_patch",
  "golden",
  "none"
]);

export const PatternPromotionInputSchema = z.object({
  candidateId: z.string().min(1),
  text: z.string().min(1),
  sourceEventIds: z.array(z.string().min(1)).default([]),
  repo: z.string().optional(),
  failureTypes: z.array(LearningFailureTypeSchema).default([]),
  severity: z.enum(["none", "minor", "major", "critical"]).default("minor"),
  repeatCount: z.number().int().nonnegative().default(1),
  explicitUserPreference: z.boolean().default(false)
});

export const PatternPromotionDecisionSchema = z.object({
  candidateId: z.string().min(1),
  classification: PatternPromotionClassificationSchema,
  promotable: z.boolean(),
  recommendedQueueType: LearningQueueTypeSchema,
  promotionTarget: PatternPromotionTargetSchema,
  reason: z.string().min(1),
  requiredEvidence: z.array(z.string()),
  expectedFutureBehaviorChange: z.string(),
  suggestedRegressionEval: z.string().optional(),
  autoPromote: z.literal(false),
  requiresHumanApproval: z.literal(true)
});

export type PatternPromotionClassification = z.infer<typeof PatternPromotionClassificationSchema>;
export type PatternPromotionTarget = z.infer<typeof PatternPromotionTargetSchema>;
export type PatternPromotionInput = z.input<typeof PatternPromotionInputSchema>;
export type ParsedPatternPromotionInput = z.output<typeof PatternPromotionInputSchema>;
export type PatternPromotionDecision = z.infer<typeof PatternPromotionDecisionSchema>;
