import { z } from "zod";

export const ReleaseGateVerdictSchema = z.enum(["accept", "provisional", "reject"]);

export const ReleaseGateFindingIdSchema = z.enum([
  "build_proof_present",
  "target_environment_present",
  "rollback_plan_present",
  "staging_validation_present",
  "auth_signing_present",
  "checklist_only",
  "missing_build_proof",
  "missing_target_environment",
  "missing_rollback_plan",
  "missing_staging_validation",
  "missing_auth_signing"
]);

export const ReleaseGateFindingSchema = z.object({
  id: ReleaseGateFindingIdSchema,
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string().min(1)
});

export const ReleaseGateAnalyzerInputSchema = z.object({
  caseId: z.string().optional(),
  task: z.string().default(""),
  description: z.string().default(""),
  source: z.enum(["build_log", "release_checklist", "environment_validation", "rollback_plan", "signing_check"]).default("build_log"),
  capturedAt: z.string().datetime().optional(),
  buildPassed: z.boolean().optional(),
  targetEnvironment: z.string().optional(),
  targetValidated: z.boolean().optional(),
  rollbackPlan: z.string().optional(),
  rollbackValidated: z.boolean().optional(),
  stagingValidated: z.boolean().optional(),
  authSigningReady: z.boolean().optional(),
  checklistOnly: z.boolean().optional()
});

export const ReleaseGateAnalyzerResultSchema = z.object({
  verdict: ReleaseGateVerdictSchema,
  findings: z.array(ReleaseGateFindingSchema).min(1),
  supportsReleaseClaim: z.boolean()
});

export const ReleaseGateFixtureCaseSchema = ReleaseGateAnalyzerInputSchema.extend({
  caseId: z.string().min(1),
  descriptionLabel: z.string().min(1),
  expectedVerdict: ReleaseGateVerdictSchema,
  expectedFindingIds: z.array(ReleaseGateFindingIdSchema).min(1),
  shouldCountAsStrong: z.boolean()
});

export const ReleaseGateFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(ReleaseGateFixtureCaseSchema).min(1)
});

export type ReleaseGateAnalyzerInput = z.input<typeof ReleaseGateAnalyzerInputSchema>;
export type ReleaseGateAnalyzerResult = z.infer<typeof ReleaseGateAnalyzerResultSchema>;
export type ReleaseGateFixtureCase = z.infer<typeof ReleaseGateFixtureCaseSchema>;
export type ReleaseGateFindingId = z.infer<typeof ReleaseGateFindingIdSchema>;
