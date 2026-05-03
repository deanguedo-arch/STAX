import { z } from "zod";

export const CommandEvidenceSourceSchema = z.enum([
  "local_stax_command_output",
  "human_pasted_command_output",
  "codex_reported_command_output",
  "ci_workflow_output",
  "non_execution_evidence"
]);

export const CommandEvidenceClaimTypeSchema = z.enum([
  "behavior",
  "tests_passed",
  "build_passed",
  "typecheck_passed",
  "lint_passed",
  "release_ready",
  "unspecified"
]);

export const CommandEvidenceFamilySchema = z.enum([
  "typecheck",
  "test",
  "e2e",
  "build",
  "eval",
  "regression",
  "redteam",
  "lint",
  "ci",
  "deploy",
  "unknown"
]);

export const CommandEvidenceStatusSchema = z.enum(["passed", "failed", "partial", "unknown"]);

export const CommandProofStrengthSchema = z.enum([
  "strong_local_proof",
  "ci_proof",
  "partial_local_proof",
  "weak_human_pasted_proof",
  "weak_codex_reported_proof",
  "stale_proof",
  "wrong_repo_proof",
  "wrong_branch_proof",
  "failed_proof",
  "non_execution_evidence",
  "not_relevant_to_claim"
]);

export const CommandEvidenceIntelligenceInputSchema = z.object({
  caseId: z.string().optional(),
  command: z.string().min(1),
  cwd: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  exitCode: z.number().int().nullable().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  source: CommandEvidenceSourceSchema.default("local_stax_command_output"),
  output: z.string().default(""),
  stdoutTruncated: z.boolean().default(false),
  stderrTruncated: z.boolean().default(false),
  expectedRepo: z.string().optional(),
  expectedBranch: z.string().optional(),
  expectedCwd: z.string().optional(),
  expectedCommitSha: z.string().optional(),
  evidenceRequiredAfter: z.string().datetime().optional(),
  claimType: CommandEvidenceClaimTypeSchema.default("unspecified")
});

export const CommandEvidenceIntelligenceResultSchema = z.object({
  command: z.string().min(1),
  commandFamily: CommandEvidenceFamilySchema,
  status: CommandEvidenceStatusSchema,
  proofStrength: CommandProofStrengthSchema,
  toolchain: z.string().min(1).optional(),
  limitations: z.array(z.string()),
  warnings: z.array(z.string())
});

export const CommandEvidenceFixtureCaseSchema = CommandEvidenceIntelligenceInputSchema.extend({
  caseId: z.string().min(1),
  description: z.string().min(1),
  expectedProofStrength: CommandProofStrengthSchema,
  expectedStatus: CommandEvidenceStatusSchema.optional(),
  expectedFamily: CommandEvidenceFamilySchema.optional(),
  shouldBeStrong: z.boolean()
});

export const CommandEvidenceFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(CommandEvidenceFixtureCaseSchema).min(1)
});

export type CommandEvidenceSource = z.infer<typeof CommandEvidenceSourceSchema>;
export type CommandEvidenceClaimType = z.infer<typeof CommandEvidenceClaimTypeSchema>;
export type CommandEvidenceFamily = z.infer<typeof CommandEvidenceFamilySchema>;
export type CommandEvidenceStatus = z.infer<typeof CommandEvidenceStatusSchema>;
export type CommandProofStrength = z.infer<typeof CommandProofStrengthSchema>;
export type CommandEvidenceIntelligenceInput = z.input<typeof CommandEvidenceIntelligenceInputSchema>;
export type ParsedCommandEvidenceIntelligenceInput = z.infer<typeof CommandEvidenceIntelligenceInputSchema>;
export type CommandEvidenceIntelligenceResult = z.infer<typeof CommandEvidenceIntelligenceResultSchema>;
export type CommandEvidenceFixtureCase = z.infer<typeof CommandEvidenceFixtureCaseSchema>;
