import { z } from "zod";

export const ControlAuditCaseSchema = z.object({
  caseId: z.string().min(1),
  category: z.string().min(1).optional(),
  repo: z.string().min(1).optional(),
  task: z.string().min(1),
  repoEvidence: z.string().min(1),
  commandEvidence: z.string().min(1),
  codexReport: z.string().min(1).optional(),
  expectedBestTraits: z.array(z.string().min(1)).optional()
});

export const ControlAuditCaseArraySchema = z.array(ControlAuditCaseSchema).min(1);

export const ControlAuditCaseCollectionSchema = z.object({
  benchmarkId: z.string().min(1).optional(),
  version: z.number().int().positive().optional(),
  status: z.string().min(1).optional(),
  cases: ControlAuditCaseArraySchema
});

export type ControlAuditCase = z.infer<typeof ControlAuditCaseSchema>;
export type ControlAuditCaseCollection = z.infer<typeof ControlAuditCaseCollectionSchema>;

