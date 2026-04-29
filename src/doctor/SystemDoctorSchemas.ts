import { z } from "zod";
import type { ClassifierProviderType, ProviderType } from "../schemas/Config.js";

export const DoctorProviderStatusSchema = z.object({
  role: z.enum(["generator", "critic", "evaluator", "classifier"]),
  provider: z.union([z.custom<ProviderType>(), z.custom<ClassifierProviderType>()]),
  model: z.string(),
  warning: z.string().optional()
});

export const DoctorEvalStatusSchema = z.object({
  status: z.enum(["present", "missing"]),
  path: z.string().optional(),
  total: z.number().int().nonnegative().optional(),
  passed: z.number().int().nonnegative().optional(),
  failed: z.number().int().nonnegative().optional(),
  criticalFailures: z.number().int().nonnegative().optional()
});

export const DoctorRunStatusSchema = z.object({
  status: z.enum(["present", "missing"]),
  path: z.string().optional()
});

export const DoctorCommandEvidenceStatusSchema = z.object({
  total: z.number().int().nonnegative(),
  localStax: z.number().int().nonnegative(),
  humanPasted: z.number().int().nonnegative(),
  codexReported: z.number().int().nonnegative()
});

export const DoctorRepoEvidenceStatusSchema = z.object({
  status: z.enum(["available", "not_configured", "failed"]),
  workspace: z.string().optional(),
  linkedRepoPath: z.string().optional(),
  safeFilesRead: z.number().int().nonnegative().optional(),
  error: z.string().optional()
});

export const SystemDoctorReportSchema = z.object({
  rootDir: z.string(),
  providers: z.array(DoctorProviderStatusSchema),
  openaiKeyConfigured: z.boolean(),
  ollamaConfigured: z.boolean(),
  tools: z.object({
    fileRead: z.string(),
    fileWrite: z.string(),
    shell: z.string(),
    web: z.string(),
    git: z.string()
  }),
  memory: z.object({
    autoSaveModelOutputs: z.boolean(),
    requireUserApprovedMemory: z.boolean(),
    approvedMemorySearchOnly: z.boolean()
  }),
  eval: DoctorEvalStatusSchema,
  latestRun: DoctorRunStatusSchema,
  commandEvidence: DoctorCommandEvidenceStatusSchema,
  repoEvidence: DoctorRepoEvidenceStatusSchema,
  gitStatus: z.string(),
  warnings: z.array(z.string())
});

export type SystemDoctorReport = z.infer<typeof SystemDoctorReportSchema>;
