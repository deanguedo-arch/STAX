import { z } from "zod";

export const RuntimeEvidenceStrengthSchema = z.enum([
  "none",
  "source_inspection",
  "script_discovered",
  "test_file_discovered",
  "pasted_command_output",
  "codex_reported_command_output",
  "stored_command_evidence",
  "local_stax_command_evidence"
]);

export const RuntimeTruthStatusSchema = z.enum([
  "unknown",
  "partial",
  "scoped_verified",
  "failed"
]);

export const RuntimeEvidenceInputSchema = z.object({
  claim: z.string().min(1),
  evidence: z.string().default(""),
  repo: z.string().optional(),
  commandEvidence: z.array(z.object({
    command: z.string().min(1),
    exitCode: z.number().int(),
    success: z.boolean().optional(),
    source: z.enum(["human_pasted_command_output", "codex_reported_command_output", "local_stax_command_output"]).optional(),
    status: z.enum(["passed", "failed", "partial", "unknown"]).optional(),
    createdAt: z.string().optional(),
    workspace: z.string().optional(),
    linkedRepoPath: z.string().optional(),
    summary: z.string().optional()
  })).optional()
});

export const RuntimeEvidenceResultSchema = z.object({
  status: RuntimeTruthStatusSchema,
  strength: RuntimeEvidenceStrengthSchema,
  verifiedScope: z.array(z.string()),
  unverifiedScope: z.array(z.string()),
  requiredNextCommand: z.string().optional(),
  reasons: z.array(z.string())
});

export type RuntimeEvidenceStrength = z.infer<typeof RuntimeEvidenceStrengthSchema>;
export type RuntimeTruthStatus = z.infer<typeof RuntimeTruthStatusSchema>;
export type RuntimeEvidenceInput = z.input<typeof RuntimeEvidenceInputSchema>;
export type RuntimeEvidenceResult = z.infer<typeof RuntimeEvidenceResultSchema>;
