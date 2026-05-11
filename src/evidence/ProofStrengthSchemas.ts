import { z } from "zod";
import { CommandEvidenceSchema } from "./CommandEvidenceStore.js";
import { EvidenceGroundingResultSchema } from "./EvidenceGroundingSchemas.js";
import { RepoEvidencePackSchema } from "../workspace/RepoEvidenceSchemas.js";

export const ProofStrengthClaimTypeSchema = z.enum([
  "implementation_complete",
  "tests_passed",
  "visual_behavior_verified",
  "release_ready",
  "security_fixed",
  "verification_run"
]);

export const ProofStrengthLabelSchema = z.enum([
  "Missing",
  "Weak",
  "Provisional",
  "Strong",
  "Audit-grade",
  "Reject"
]);

export const ProofStrengthCapMaxLabelSchema = z.enum([
  "Missing",
  "Weak",
  "Provisional",
  "Strong"
]);

export const ProofStrengthCapSchema = z.object({
  id: z.string().min(1),
  maxLabel: ProofStrengthCapMaxLabelSchema,
  reason: z.string().min(1)
});

export const ProofEvidenceFlagsSchema = z.object({
  visualProof: z.boolean().default(false),
  releasePreflight: z.boolean().default(false),
  releaseGate: z.boolean().default(false),
  rollbackPlan: z.boolean().default(false),
  securityProof: z.boolean().default(false)
}).default({
  visualProof: false,
  releasePreflight: false,
  releaseGate: false,
  rollbackPlan: false,
  securityProof: false
});

export const ProofStrengthInputSchema = z.object({
  claimType: ProofStrengthClaimTypeSchema,
  claimText: z.string().min(1),
  groundingResult: EvidenceGroundingResultSchema,
  commandEvidence: z.array(CommandEvidenceSchema).default([]),
  repoEvidence: RepoEvidencePackSchema.optional(),
  expectedRepoPath: z.string().optional(),
  expectedWorkspace: z.string().optional(),
  evidenceFlags: ProofEvidenceFlagsSchema
});

export const ProofStrengthResultSchema = z.object({
  schemaVersion: z.literal("proof-strength-v1"),
  claimType: ProofStrengthClaimTypeSchema,
  claimText: z.string().min(1),
  rawScore: z.number().min(0).max(1),
  finalScore: z.number().min(0).max(1),
  label: ProofStrengthLabelSchema,
  capApplied: z.array(ProofStrengthCapSchema),
  rejectReasons: z.array(z.string()),
  primaryLimiter: z.string(),
  missingProof: z.array(z.string()),
  weakProof: z.array(z.string()),
  strongProof: z.array(z.string()),
  oneNextAction: z.string().min(1)
});

export const ProofStrengthTraceSummarySchema = z.object({
  label: ProofStrengthLabelSchema,
  rawScore: z.number().min(0).max(1),
  finalScore: z.number().min(0).max(1),
  capApplied: z.array(z.string()),
  primaryLimiter: z.string()
});

export type ProofStrengthClaimType = z.infer<typeof ProofStrengthClaimTypeSchema>;
export type ProofStrengthLabel = z.infer<typeof ProofStrengthLabelSchema>;
export type ProofStrengthCap = z.infer<typeof ProofStrengthCapSchema>;
export type ProofStrengthInput = z.input<typeof ProofStrengthInputSchema>;
export type ProofStrengthResult = z.infer<typeof ProofStrengthResultSchema>;
export type ProofStrengthTraceSummary = z.infer<typeof ProofStrengthTraceSummarySchema>;
