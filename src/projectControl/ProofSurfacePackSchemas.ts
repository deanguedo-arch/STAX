import { z } from "zod";

export const ProofSurfaceConfidenceSchema = z.enum(["low", "medium", "high"]);
export const ProofSurfaceStatusSchema = z.enum(["candidate", "approved", "static"]);

export const ProofSurfaceRuleSchema = z.object({
  claimType: z.string().min(1),
  requiredEvidence: z.array(z.string().min(1)).default([]),
  commands: z.array(z.string().min(1)).default([]),
  blockedEvidence: z.array(z.string().min(1)).default([]),
  confidence: ProofSurfaceConfidenceSchema.default("medium"),
  source: z.string().min(1),
  nextAction: z.string().min(1).optional()
});

export const ProofSurfaceBlockedActionSchema = z.object({
  action: z.string().min(1),
  requires: z.array(z.string().min(1)).default([])
});

export const ProofSurfacePackSchema = z.object({
  schemaVersion: z.literal("stax-proof-surface-pack-v1"),
  repoPath: z.string().optional(),
  repoName: z.string().optional(),
  status: ProofSurfaceStatusSchema,
  generatedAt: z.string().optional(),
  approvedAt: z.string().optional(),
  confidence: ProofSurfaceConfidenceSchema.default("medium"),
  detectedStack: z.array(z.string().min(1)).default([]),
  proofSurfaces: z.array(ProofSurfaceRuleSchema).default([]),
  blockedActions: z.array(ProofSurfaceBlockedActionSchema).default([]),
  warnings: z.array(z.string().min(1)).default([])
});

export type ProofSurfaceConfidence = z.infer<typeof ProofSurfaceConfidenceSchema>;
export type ProofSurfaceStatus = z.infer<typeof ProofSurfaceStatusSchema>;
export type ProofSurfaceRule = z.infer<typeof ProofSurfaceRuleSchema>;
export type ProofSurfaceBlockedAction = z.infer<typeof ProofSurfaceBlockedActionSchema>;
export type ProofSurfacePack = z.infer<typeof ProofSurfacePackSchema>;
