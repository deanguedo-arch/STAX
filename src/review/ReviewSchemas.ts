import { z } from "zod";

export const REVIEW_ROUTER_VERSION = "v1";

export const ReviewDispositionSchema = z.enum([
  "auto_archive",
  "auto_candidate",
  "auto_stage_for_review",
  "batch_review",
  "human_review",
  "hard_block"
]);

export const ReviewRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const ReviewConfidenceSchema = z.enum(["low", "medium", "high"]);

export const ReviewSourceTypeSchema = z.enum([
  "learning_event",
  "learning_queue_item",
  "lab_candidate",
  "correction",
  "eval_candidate",
  "patch_proposal",
  "codex_handoff",
  "command_event",
  "eval_pair",
  "unknown"
]);

export const ReviewStateSchema = z.enum([
  "active",
  "stale",
  "invalidated",
  "archived",
  "rejected",
  "escalated"
]);

export const ReviewSourceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: ReviewSourceTypeSchema,
  sourcePath: z.string().min(1).optional(),
  content: z.string().optional(),
  workspace: z.string().optional(),
  synthetic: z.boolean().optional(),
  approvalState: z.string().optional(),
  mode: z.string().optional(),
  targetArtifactType: z.string().optional(),
  targetPaths: z.array(z.string()).default([]),
  failureTypes: z.array(z.string()).default([]),
  riskTags: z.array(z.string()).default([]),
  evidencePaths: z.array(z.string()).default([]),
  reason: z.string().optional(),
  repeatedCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional()
});

export const ReviewTriageResultSchema = z.object({
  disposition: ReviewDispositionSchema,
  riskLevel: ReviewRiskLevelSchema,
  riskScore: z.number().min(0).max(100),
  confidence: ReviewConfidenceSchema,
  reasonCodes: z.array(z.string()),
  evidencePaths: z.array(z.string()),
  requiresHuman: z.boolean(),
  requiresReason: z.boolean(),
  allowedActions: z.array(z.string())
});

export const ReviewRecordSchema = z.object({
  reviewId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceHash: z.string().min(1),
  sourceType: ReviewSourceTypeSchema,
  sourcePath: z.string().min(1).optional(),
  workspace: z.string().optional(),
  riskScore: z.number().min(0).max(100),
  riskLevel: ReviewRiskLevelSchema,
  confidence: ReviewConfidenceSchema,
  disposition: ReviewDispositionSchema,
  reasonCodes: z.array(z.string()),
  evidencePaths: z.array(z.string()),
  routerVersion: z.literal(REVIEW_ROUTER_VERSION),
  state: ReviewStateSchema,
  requiresPromotionGate: z.literal(true),
  allowedActions: z.array(z.string()),
  supersedesReviewIds: z.array(z.string()).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  stateReason: z.string().optional()
});

export const ReviewBatchSchema = z.object({
  batchId: z.string().min(1),
  createdAt: z.string().min(1),
  workspace: z.string().optional(),
  reviewIds: z.array(z.string()),
  counts: z.record(z.string(), z.number())
});

export const ReviewStatsSchema = z.object({
  updatedAt: z.string().min(1),
  total: z.number().int().nonnegative(),
  byDisposition: z.record(z.string(), z.number()),
  byRisk: z.record(z.string(), z.number()),
  byState: z.record(z.string(), z.number())
});

export type ReviewDisposition = z.infer<typeof ReviewDispositionSchema>;
export type ReviewRiskLevel = z.infer<typeof ReviewRiskLevelSchema>;
export type ReviewConfidence = z.infer<typeof ReviewConfidenceSchema>;
export type ReviewSourceType = z.infer<typeof ReviewSourceTypeSchema>;
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export type ReviewSource = z.infer<typeof ReviewSourceSchema>;
export type ReviewTriageResult = z.infer<typeof ReviewTriageResultSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type ReviewBatch = z.infer<typeof ReviewBatchSchema>;
export type ReviewStats = z.infer<typeof ReviewStatsSchema>;
