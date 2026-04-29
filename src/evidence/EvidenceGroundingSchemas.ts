import { z } from "zod";
import { CommandEvidenceSchema } from "./CommandEvidenceStore.js";
import { RepoEvidencePackSchema } from "../workspace/RepoEvidenceSchemas.js";

export const GroundedClaimKindSchema = z.enum([
  "file_path",
  "command",
  "test_pass",
  "completion",
  "verification"
]);

export const GroundedClaimStatusSchema = z.enum([
  "supported",
  "weak",
  "unsupported",
  "not_applicable"
]);

export const GroundedClaimSchema = z.object({
  kind: GroundedClaimKindSchema,
  text: z.string().min(1),
  status: GroundedClaimStatusSchema,
  support: z.string().optional(),
  reason: z.string().optional()
});

export const EvidenceGroundingInputSchema = z.object({
  output: z.string(),
  mode: z.string().optional(),
  repoEvidence: RepoEvidencePackSchema.optional(),
  commandEvidence: z.array(CommandEvidenceSchema).default([]),
  userSuppliedEvidence: z.array(z.string()).default([])
});

export const EvidenceGroundingResultSchema = z.object({
  pass: z.boolean(),
  claims: z.array(GroundedClaimSchema),
  supportedClaims: z.array(GroundedClaimSchema),
  weakClaims: z.array(GroundedClaimSchema),
  unsupportedClaims: z.array(GroundedClaimSchema),
  requiredFixes: z.array(z.string())
});

export type GroundedClaimKind = z.infer<typeof GroundedClaimKindSchema>;
export type GroundedClaimStatus = z.infer<typeof GroundedClaimStatusSchema>;
export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;
export type EvidenceGroundingInput = z.input<typeof EvidenceGroundingInputSchema>;
export type EvidenceGroundingResult = z.infer<typeof EvidenceGroundingResultSchema>;
