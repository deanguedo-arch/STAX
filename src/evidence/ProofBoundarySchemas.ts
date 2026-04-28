import { z } from "zod";

export const EvidenceFamilySchema = z.enum([
  "docx",
  "pdf",
  "ocr",
  "structured_recovery",
  "course_shell",
  "e2e",
  "rendered_preview",
  "fixture",
  "rendered_export",
  "conversion",
  "validation",
  "build",
  "deploy",
  "no_test_script",
  "unknown"
]);

export const ProofBoundaryInputSchema = z.object({
  claim: z.string().min(1),
  evidence: z.string().default("")
});

export const ProofBoundaryResultSchema = z.object({
  claim: z.string().min(1),
  evidenceFamily: EvidenceFamilySchema,
  verifiedScope: z.array(z.string()),
  unverifiedScope: z.array(z.string()),
  requiredNextProof: z.array(z.string())
});

export type EvidenceFamily = z.infer<typeof EvidenceFamilySchema>;
export type ProofBoundaryInput = z.input<typeof ProofBoundaryInputSchema>;
export type ProofBoundaryResult = z.infer<typeof ProofBoundaryResultSchema>;
