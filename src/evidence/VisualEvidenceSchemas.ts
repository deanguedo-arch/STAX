import { z } from "zod";

export const VisualArtifactTypeSchema = z.enum([
  "screenshot",
  "playwright_screenshot",
  "manual_visual_finding",
  "missing"
]);

export const VisualEvidenceInputSchema = z.object({
  target: z.string().min(1),
  artifactType: VisualArtifactTypeSchema,
  artifactPath: z.string().min(1).optional(),
  artifactHash: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
  viewport: z.string().min(1).optional(),
  capturedAt: z.string().min(1).optional(),
  requiredChecks: z.array(z.string().min(1)).default([]),
  observedChecks: z.array(z.string().min(1)).default([]),
  sourceEvidenceOnly: z.boolean().default(false)
});

export const VisualEvidenceResultSchema = z.object({
  target: z.string().min(1),
  artifactType: VisualArtifactTypeSchema,
  status: z.enum(["missing", "partial", "verified"]),
  verifiedClaims: z.array(z.string()),
  unverifiedClaims: z.array(z.string()),
  requiredNextEvidence: z.array(z.string()),
  reasons: z.array(z.string())
});

export type VisualEvidenceInput = z.input<typeof VisualEvidenceInputSchema>;
export type VisualEvidenceResult = z.infer<typeof VisualEvidenceResultSchema>;
