import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { RaxMode } from "../schemas/Config.js";

export const LearningWorkerRoleSchema = z.enum([
  "curriculum",
  "scenario_generator",
  "redteam",
  "eval_builder",
  "correction_builder",
  "dataset_curator",
  "critic"
]);

export const LearningLabDomainSchema = z.enum([
  "planning",
  "audit",
  "project_brain",
  "codex_audit",
  "learning_unit",
  "policy_drift",
  "test_gap_audit",
  "stax_fitness",
  "redteam_governance"
]);

export const LearningLabDifficultySchema = z.enum(["easy", "medium", "hard", "adversarial"]);
export const LearningLabApprovalStateSchema = z.enum(["candidate", "approved", "rejected"]);

export const LearningWorkerResultSchema = z
  .object({
    workerId: z.string().min(1),
    role: LearningWorkerRoleSchema,
    createdAt: z.string().min(1),
    inputs: z.array(z.string()),
    outputs: z.array(z.string()),
    candidatesCreated: z.array(z.string()),
    warnings: z.array(z.string()),
    requiresApproval: z.boolean()
  })
  .superRefine((value, context) => {
    if (value.candidatesCreated.length > 0 && !value.requiresApproval) {
      context.addIssue({
        code: "custom",
        path: ["requiresApproval"],
        message: "candidate-creating workers require approval"
      });
    }
  });

const LabModeSchema = z.enum([
  "analysis",
  "planning",
  "audit",
  "stax_fitness",
  "project_brain",
  "codex_audit",
  "test_gap_audit",
  "policy_drift",
  "learning_unit"
]);

export const CurriculumItemSchema = z.object({
  id: z.string().min(1),
  domain: LearningLabDomainSchema,
  difficulty: LearningLabDifficultySchema,
  objective: z.string().min(1),
  targetMode: LabModeSchema,
  skills: z.array(z.string()),
  riskTags: z.array(z.string()),
  expectedProperties: z.array(z.string()),
  forbiddenPatterns: z.array(z.string()),
  synthetic: z.literal(true),
  approvalState: z.literal("candidate")
});

export const CurriculumPackSchema = z.object({
  curriculumId: z.string().min(1),
  domain: LearningLabDomainSchema,
  createdAt: z.string().min(1),
  synthetic: z.literal(true),
  approvalState: z.literal("candidate"),
  items: z.array(CurriculumItemSchema)
});

export const LabScenarioSchema = z.object({
  id: z.string().min(1),
  sourceCurriculumId: z.string().min(1),
  domain: LearningLabDomainSchema,
  mode: LabModeSchema,
  input: z.string().min(1),
  expectedProperties: z.array(z.string()),
  forbiddenPatterns: z.array(z.string()),
  requiredSections: z.array(z.string()),
  riskTags: z.array(z.string()),
  critical: z.boolean(),
  synthetic: z.literal(true),
  approvalState: z.literal("candidate")
});

export const LabScenarioSetSchema = z.object({
  scenarioSetId: z.string().min(1),
  sourceCurriculumPath: z.string().optional(),
  domain: LearningLabDomainSchema,
  createdAt: z.string().min(1),
  synthetic: z.literal(true),
  approvalState: z.literal("candidate"),
  scenarios: z.array(LabScenarioSchema)
});

export const LabResultSchema = z.object({
  scenarioId: z.string().min(1),
  domain: LearningLabDomainSchema,
  mode: LabModeSchema,
  runId: z.string().min(1),
  learningEventId: z.string().min(1),
  pass: z.boolean(),
  failReasons: z.array(z.string()),
  queuesCreated: z.array(z.string()),
  tracePath: z.string().min(1),
  finalPath: z.string().min(1)
});

export const LabRunRecordSchema = z.object({
  labRunId: z.string().min(1),
  scenarioFile: z.string().min(1),
  createdAt: z.string().min(1),
  synthetic: z.literal(true),
  results: z.array(LabResultSchema)
});

export const LabCandidateSchema = z.object({
  candidateId: z.string().min(1),
  candidateType: z.enum(["eval", "correction", "training", "memory"]),
  sourceScenarioId: z.string().min(1),
  runId: z.string().min(1),
  learningEventId: z.string().min(1),
  createdAt: z.string().min(1),
  synthetic: z.literal(true),
  approvalState: z.literal("candidate"),
  requiresApproval: z.literal(true),
  reason: z.string().min(1),
  artifact: z.record(z.string(), z.unknown())
});

export type LearningWorkerRole = z.infer<typeof LearningWorkerRoleSchema>;
export type LearningLabDomain = z.infer<typeof LearningLabDomainSchema>;
export type LearningLabDifficulty = z.infer<typeof LearningLabDifficultySchema>;
export type LearningWorkerResult = z.infer<typeof LearningWorkerResultSchema>;
export type CurriculumItem = z.infer<typeof CurriculumItemSchema>;
export type CurriculumPack = z.infer<typeof CurriculumPackSchema>;
export type LabScenario = z.infer<typeof LabScenarioSchema>;
export type LabScenarioSet = z.infer<typeof LabScenarioSetSchema>;
export type LabResult = z.infer<typeof LabResultSchema>;
export type LabRunRecord = z.infer<typeof LabRunRecordSchema>;
export type LabCandidate = z.infer<typeof LabCandidateSchema>;
export type LabMode = z.infer<typeof LabModeSchema> & RaxMode;

export const labDirs = [
  "learning/lab/curricula",
  "learning/lab/scenarios",
  "learning/lab/runs",
  "learning/lab/reports",
  "learning/lab/candidates/eval",
  "learning/lab/candidates/correction",
  "learning/lab/candidates/training",
  "learning/lab/candidates/memory"
];

export async function ensureLabDirs(rootDir = process.cwd()): Promise<void> {
  await Promise.all(labDirs.map((dir) => fs.mkdir(path.join(rootDir, dir), { recursive: true })));
}

export function labId(prefix: string): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${now}-${random}`;
}

export function labTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function resolveLabPath(rootDir: string, file: string): string {
  return path.isAbsolute(file) ? file : path.join(rootDir, file);
}

export function relativeLabPath(rootDir: string, file: string): string {
  return path.relative(rootDir, file);
}
