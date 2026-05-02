import { z } from "zod";

export const ClaimProofClaimTypeSchema = z.enum([
  "implementation",
  "test",
  "behavior",
  "visual",
  "data",
  "release_deploy",
  "memory_promotion",
  "security"
]);

export const ClaimProofTypeSchema = z.enum([
  "source_diff",
  "test_diff",
  "command_evidence_after_diff",
  "behavior_test",
  "rendered_visual_proof",
  "data_validation",
  "row_count_diff",
  "dry_run_artifact",
  "build_proof",
  "target_environment_proof",
  "rollback_plan",
  "human_approval",
  "source_run_reference",
  "security_test",
  "secret_scan"
]);

export const ClaimProofStrengthSchema = z.enum(["strong", "weak", "missing"]);
export const ClaimProofVerdictSchema = z.enum(["accept", "reject", "provisional"]);

export const ClaimProofItemSchema = z.object({
  proofType: ClaimProofTypeSchema,
  strength: ClaimProofStrengthSchema,
  description: z.string().min(1)
});

export const ClaimProofMappingInputSchema = z.object({
  caseId: z.string().optional(),
  claimType: ClaimProofClaimTypeSchema,
  claim: z.string().min(1),
  hardClaim: z.boolean().default(true),
  suppliedProof: z.array(ClaimProofItemSchema).default([])
});

export const ClaimProofMappingResultSchema = z.object({
  verdict: ClaimProofVerdictSchema,
  requiredProof: z.array(ClaimProofTypeSchema),
  missingProof: z.array(ClaimProofTypeSchema),
  weakProof: z.array(ClaimProofTypeSchema),
  unsupportedHardClaim: z.boolean(),
  explanation: z.string().min(1)
});

export const ClaimProofFixtureCaseSchema = ClaimProofMappingInputSchema.extend({
  caseId: z.string().min(1),
  description: z.string().min(1),
  repeat: z.number().int().positive().default(1),
  expectedVerdict: ClaimProofVerdictSchema,
  shouldAccept: z.boolean()
});

export const ClaimProofFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(ClaimProofFixtureCaseSchema).min(1)
});

export type ClaimProofClaimType = z.infer<typeof ClaimProofClaimTypeSchema>;
export type ClaimProofType = z.infer<typeof ClaimProofTypeSchema>;
export type ClaimProofStrength = z.infer<typeof ClaimProofStrengthSchema>;
export type ClaimProofVerdict = z.infer<typeof ClaimProofVerdictSchema>;
export type ClaimProofItem = z.infer<typeof ClaimProofItemSchema>;
export type ClaimProofMappingInput = z.input<typeof ClaimProofMappingInputSchema>;
export type ParsedClaimProofMappingInput = z.infer<typeof ClaimProofMappingInputSchema>;
export type ClaimProofMappingResult = z.infer<typeof ClaimProofMappingResultSchema>;
export type ClaimProofFixtureCase = z.infer<typeof ClaimProofFixtureCaseSchema>;
