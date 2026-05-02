import { z } from "zod";

export const DiffFileRoleSchema = z.enum([
  "source",
  "test",
  "docs",
  "fixture",
  "config",
  "generated",
  "lockfile",
  "script",
  "migration",
  "visual_style",
  "unknown"
]);

export const DiffChangeTypeSchema = z.enum(["added", "modified", "deleted", "renamed"]);
export const DiffRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const DiffScopeStatusSchema = z.enum([
  "in_scope",
  "maybe_in_scope",
  "out_of_scope",
  "forbidden",
  "needs_human_review"
]);

export const DiffClaimTypeSchema = z.enum([
  "implementation",
  "test",
  "behavior",
  "visual",
  "data",
  "release",
  "security",
  "memory_promotion",
  "unknown"
]);

export const DiffAuditVerdictSchema = z.enum(["accept", "reject", "provisional", "human_review"]);

export const DiffAuditFindingIdSchema = z.enum([
  "docs_only_implementation_claim",
  "tests_only_behavior_claim",
  "source_only_no_test_claim",
  "fixture_golden_laundering",
  "forbidden_config_change",
  "generated_file_only_claim",
  "out_of_scope_source_edit",
  "lockfile_only_overclaim",
  "visual_source_without_visual_proof"
]);

export const DiffAuditSeveritySchema = z.enum(["minor", "major", "critical"]);

export const DiffChangedFileInputSchema = z.object({
  path: z.string().min(1),
  changeType: DiffChangeTypeSchema,
  fileRole: DiffFileRoleSchema.optional(),
  riskLevel: DiffRiskLevelSchema.optional(),
  inScope: z.boolean().optional(),
  forbidden: z.boolean().optional(),
  reason: z.string().optional()
});

export const DiffAuditClaimSchema = z.object({
  claimType: DiffClaimTypeSchema,
  text: z.string().min(1),
  hardClaim: z.boolean().default(true)
});

export const DiffAuditProofEvidenceSchema = z.object({
  commandEvidenceAfterDiff: z.boolean().default(false),
  behaviorTestEvidence: z.boolean().default(false),
  visualProofProvided: z.boolean().default(false),
  humanApprovalForForbidden: z.boolean().default(false),
  taskScopePaths: z.array(z.string().min(1)).default([]),
  forbiddenPaths: z.array(z.string().min(1)).default([])
}).default({
  commandEvidenceAfterDiff: false,
  behaviorTestEvidence: false,
  visualProofProvided: false,
  humanApprovalForForbidden: false,
  taskScopePaths: [],
  forbiddenPaths: []
});

export const DiffAuditInputSchema = z.object({
  caseId: z.string().optional(),
  repo: z.string().min(1),
  branch: z.string().min(1),
  baseSha: z.string().min(1),
  headSha: z.string().min(1),
  objective: z.string().min(1),
  changedFiles: z.array(DiffChangedFileInputSchema).min(1),
  claims: z.array(DiffAuditClaimSchema).default([]),
  evidence: DiffAuditProofEvidenceSchema
});

export const ClassifiedDiffFileSchema = DiffChangedFileInputSchema.extend({
  fileRole: DiffFileRoleSchema,
  riskLevel: DiffRiskLevelSchema,
  scopeStatus: DiffScopeStatusSchema,
  forbidden: z.boolean(),
  reason: z.string()
});

export const DiffAuditFindingSchema = z.object({
  id: DiffAuditFindingIdSchema,
  severity: DiffAuditSeveritySchema,
  message: z.string().min(1),
  paths: z.array(z.string().min(1)).default([]),
  criticalIfAccepted: z.boolean()
});

export const DiffAuditSummarySchema = z.object({
  sourceFiles: z.number().int().nonnegative(),
  testFiles: z.number().int().nonnegative(),
  docsFiles: z.number().int().nonnegative(),
  fixtureFiles: z.number().int().nonnegative(),
  configFiles: z.number().int().nonnegative(),
  generatedFiles: z.number().int().nonnegative(),
  lockfileFiles: z.number().int().nonnegative(),
  scriptFiles: z.number().int().nonnegative(),
  migrationFiles: z.number().int().nonnegative(),
  visualStyleFiles: z.number().int().nonnegative(),
  unknownFiles: z.number().int().nonnegative()
});

export const DiffAuditResultSchema = z.object({
  verdict: DiffAuditVerdictSchema,
  classifiedFiles: z.array(ClassifiedDiffFileSchema).min(1),
  findings: z.array(DiffAuditFindingSchema),
  summary: DiffAuditSummarySchema,
  nextAction: z.string().min(1)
});

export const DiffAuditFixtureCaseSchema = DiffAuditInputSchema.extend({
  caseId: z.string().min(1),
  description: z.string().min(1),
  expectedFindingIds: z.array(DiffAuditFindingIdSchema),
  shouldAccept: z.boolean()
});

export const DiffAuditFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(DiffAuditFixtureCaseSchema).min(1)
});

export type DiffFileRole = z.infer<typeof DiffFileRoleSchema>;
export type DiffChangeType = z.infer<typeof DiffChangeTypeSchema>;
export type DiffRiskLevel = z.infer<typeof DiffRiskLevelSchema>;
export type DiffScopeStatus = z.infer<typeof DiffScopeStatusSchema>;
export type DiffClaimType = z.infer<typeof DiffClaimTypeSchema>;
export type DiffAuditVerdict = z.infer<typeof DiffAuditVerdictSchema>;
export type DiffAuditFindingId = z.infer<typeof DiffAuditFindingIdSchema>;
export type DiffAuditFinding = z.infer<typeof DiffAuditFindingSchema>;
export type DiffAuditInput = z.input<typeof DiffAuditInputSchema>;
export type ParsedDiffAuditInput = z.infer<typeof DiffAuditInputSchema>;
export type ClassifiedDiffFile = z.infer<typeof ClassifiedDiffFileSchema>;
export type DiffAuditResult = z.infer<typeof DiffAuditResultSchema>;
export type DiffAuditFixtureCase = z.infer<typeof DiffAuditFixtureCaseSchema>;
