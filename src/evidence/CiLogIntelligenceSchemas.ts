import { z } from "zod";
import {
  CommandEvidenceClaimTypeSchema,
  CommandEvidenceStatusSchema,
  CommandProofStrengthSchema
} from "./CommandEvidenceIntelligenceSchemas.js";

export const CiWorkflowConclusionSchema = z.enum([
  "success",
  "failure",
  "cancelled",
  "skipped",
  "pending",
  "unknown"
]);

export const CiLogIntelligenceInputSchema = z.object({
  caseId: z.string().optional(),
  workflow: z.string().min(1),
  jobName: z.string().optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  conclusion: CiWorkflowConclusionSchema.default("unknown"),
  summary: z.string().default(""),
  log: z.string().default(""),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  expectedWorkflow: z.string().optional(),
  expectedBranch: z.string().optional(),
  expectedCommitSha: z.string().optional(),
  evidenceRequiredAfter: z.string().datetime().optional(),
  claimType: CommandEvidenceClaimTypeSchema.default("behavior"),
  expectedJobCount: z.number().int().nonnegative().optional(),
  completedJobCount: z.number().int().nonnegative().optional(),
  failedJobCount: z.number().int().nonnegative().default(0),
  cancelledJobCount: z.number().int().nonnegative().default(0),
  skippedJobCount: z.number().int().nonnegative().default(0)
});

export const CiLogIntelligenceResultSchema = z.object({
  workflow: z.string().min(1),
  status: CommandEvidenceStatusSchema,
  proofStrength: CommandProofStrengthSchema,
  matrixState: z.enum(["complete", "partial", "unknown"]),
  flags: z.array(z.string()),
  limitations: z.array(z.string()),
  warnings: z.array(z.string())
});

export const CiLogFixtureCaseSchema = CiLogIntelligenceInputSchema.extend({
  caseId: z.string().min(1),
  description: z.string().min(1),
  expectedProofStrength: CommandProofStrengthSchema,
  expectedStatus: CommandEvidenceStatusSchema,
  expectedMatrixState: z.enum(["complete", "partial", "unknown"]),
  shouldCountAsPassing: z.boolean()
});

export const CiLogFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(CiLogFixtureCaseSchema).min(1)
});

export type CiWorkflowConclusion = z.infer<typeof CiWorkflowConclusionSchema>;
export type CiLogIntelligenceInput = z.input<typeof CiLogIntelligenceInputSchema>;
export type ParsedCiLogIntelligenceInput = z.infer<typeof CiLogIntelligenceInputSchema>;
export type CiLogIntelligenceResult = z.infer<typeof CiLogIntelligenceResultSchema>;
export type CiLogFixtureCase = z.infer<typeof CiLogFixtureCaseSchema>;
