import { z } from "zod";

export const EvidenceRequestKindSchema = z.enum([
  "repo_question",
  "ui_question",
  "codex_report",
  "deploy_issue",
  "runtime_claim",
  "unknown"
]);

export const EvidenceRequestInputSchema = z.object({
  task: z.string().min(1),
  reason: z.string().default("no_local_basis"),
  repo: z.string().optional(),
  availableEvidence: z.string().default("")
});

export const EvidenceRequestResultSchema = z.object({
  reason: z.string(),
  requestKind: EvidenceRequestKindSchema,
  minimumEvidenceNeeded: z.array(z.string()),
  pasteBackInstructions: z.string(),
  exampleCommand: z.string(),
  canProceedWithoutEvidence: z.boolean()
});

export type EvidenceRequestInput = z.input<typeof EvidenceRequestInputSchema>;
export type EvidenceRequestResult = z.infer<typeof EvidenceRequestResultSchema>;
