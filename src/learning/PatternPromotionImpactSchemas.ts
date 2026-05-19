import { z } from "zod";
import {
  PatternPromotionActionSchema,
  PatternPromotionClassificationSchema,
  PatternPromotionTargetSchema
} from "./PatternPromotionSchemas.js";
import { LearningFailureTypeSchema } from "./LearningEvent.js";

export const PatternPromotionImpactOutcomeSchema = z.enum(["improved", "unchanged_safe", "regressed"]);

export const PatternPromotionExpectedDecisionSchema = z.object({
  classification: PatternPromotionClassificationSchema,
  recommendedAction: PatternPromotionActionSchema,
  promotionTarget: PatternPromotionTargetSchema,
  promotable: z.boolean().optional()
});

export const LockedReplayImpactCaseSchema = z.object({
  caseId: z.string().min(1),
  promotionId: z.string().min(1),
  description: z.string().min(1),
  candidateText: z.string().min(1),
  sourceEventIds: z.array(z.string().min(1)).default([]),
  repeatCount: z.number().int().nonnegative().default(1),
  severity: z.enum(["none", "minor", "major", "critical"]).default("minor"),
  failureTypes: z.array(LearningFailureTypeSchema).default([]),
  explicitUserPreference: z.boolean().default(false),
  codeChangeBacked: z.boolean().default(false),
  testBacked: z.boolean().default(false),
  realRunBacked: z.boolean().default(false),
  reusableAcrossRepos: z.boolean().default(false),
  repoScoped: z.boolean().default(false),
  humanApproved: z.boolean().default(false),
  baselineDecision: PatternPromotionExpectedDecisionSchema.optional(),
  expectedDecision: PatternPromotionExpectedDecisionSchema,
  expectedFutureBehaviorContains: z.string().min(1).optional(),
  criticalMiss: z.boolean().default(false)
});

export const LockedReplayImpactFixtureSchema = z.object({
  schemaVersion: z.literal("stax-pattern-promotion-locked-replay-v1"),
  description: z.string().min(1),
  cases: z.array(LockedReplayImpactCaseSchema).min(1)
});

export const LockedReplayImpactResultSchema = z.object({
  caseId: z.string().min(1),
  promotionId: z.string().min(1),
  outcome: PatternPromotionImpactOutcomeSchema,
  criticalMiss: z.boolean(),
  expectedClassification: PatternPromotionClassificationSchema,
  actualClassification: PatternPromotionClassificationSchema,
  expectedAction: PatternPromotionActionSchema,
  actualAction: PatternPromotionActionSchema,
  expectedTarget: PatternPromotionTargetSchema,
  actualTarget: PatternPromotionTargetSchema,
  failures: z.array(z.string()),
  futureBehaviorChange: z.string()
});

export const ImpactEvidenceCommandSchema = z.object({
  evidenceId: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  exitCode: z.number().int().optional(),
  source: z.string().optional(),
  provenanceStatus: z.string().optional(),
  worktreeAfterHash: z.string().optional(),
  canonicalEvidenceHash: z.string().optional(),
  recordedAt: z.string().optional()
});

export const ImpactEvidenceArtifactSchema = z.object({
  kind: z.string().min(1),
  path: z.string().min(1).optional(),
  hash: z.string().optional(),
  summary: z.string().optional()
});

export const StaxImpactEvidenceBundleSchema = z.object({
  schemaVersion: z.literal("stax-impact-evidence-bundle-v1"),
  generatedAt: z.string().datetime(),
  repo: z.object({
    path: z.string().min(1),
    name: z.string().min(1),
    branch: z.string().optional(),
    head: z.string().optional(),
    dirtyStatus: z.string()
  }),
  stax: z.object({
    commit: z.string().optional(),
    sidecarProtocolVersion: z.string().optional(),
    proofSurfaceVersion: z.string().optional()
  }),
  task: z.string(),
  staxOutput: z.string(),
  codexReport: z.string(),
  commandEvidence: z.array(ImpactEvidenceCommandSchema),
  artifacts: z.array(ImpactEvidenceArtifactSchema),
  criticalMiss: z.boolean(),
  cleanupPromptNeeded: z.boolean(),
  fullHandoffContractPresent: z.boolean(),
  proofArtifactRequested: z.boolean()
});

export const CurrentOperatingImpactResultSchema = z.object({
  repo: z.string().min(1),
  branch: z.string().optional(),
  head: z.string().optional(),
  outcome: PatternPromotionImpactOutcomeSchema,
  criticalMiss: z.boolean(),
  cleanupPromptNeeded: z.boolean(),
  fullHandoffContractPresent: z.boolean(),
  proofArtifactRequested: z.boolean(),
  commandEvidenceCount: z.number().int().nonnegative(),
  artifactCount: z.number().int().nonnegative(),
  failures: z.array(z.string())
});

export const PatternPromotionImpactReportSchema = z.object({
  schemaVersion: z.literal("stax-pattern-promotion-impact-report-v1"),
  generatedAt: z.string().datetime(),
  lockedReplay: z.object({
    claim: z.literal("Locked replay proves whether STAX behavior changed on frozen prompts and evidence."),
    caseCount: z.number().int().nonnegative(),
    criticalMisses: z.number().int().nonnegative(),
    improved: z.number().int().nonnegative(),
    unchangedSafe: z.number().int().nonnegative(),
    regressed: z.number().int().nonnegative(),
    results: z.array(LockedReplayImpactResultSchema)
  }),
  currentOperatingWindow: z.object({
    claim: z.literal("Current operating-window evidence proves whether STAX helps live repos today."),
    importedBundleCount: z.number().int().nonnegative(),
    criticalMisses: z.number().int().nonnegative(),
    fullHandoffContracts: z.number().int().nonnegative(),
    proofArtifactsRequested: z.number().int().nonnegative(),
    cleanupPromptsNeeded: z.number().int().nonnegative(),
    results: z.array(CurrentOperatingImpactResultSchema)
  })
});

export type PatternPromotionImpactOutcome = z.infer<typeof PatternPromotionImpactOutcomeSchema>;
export type LockedReplayImpactCase = z.infer<typeof LockedReplayImpactCaseSchema>;
export type LockedReplayImpactFixture = z.infer<typeof LockedReplayImpactFixtureSchema>;
export type LockedReplayImpactResult = z.infer<typeof LockedReplayImpactResultSchema>;
export type StaxImpactEvidenceBundle = z.infer<typeof StaxImpactEvidenceBundleSchema>;
export type CurrentOperatingImpactResult = z.infer<typeof CurrentOperatingImpactResultSchema>;
export type PatternPromotionImpactReport = z.infer<typeof PatternPromotionImpactReportSchema>;
