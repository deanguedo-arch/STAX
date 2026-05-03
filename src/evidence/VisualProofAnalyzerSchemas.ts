import { z } from "zod";

export const VisualProofVerdictSchema = z.enum(["accept", "provisional", "reject"]);

export const VisualProofFindingIdSchema = z.enum([
  "screenshot_present",
  "visual_checklist_present",
  "missing_visual_artifact",
  "stale_visual_artifact",
  "wrong_page_or_state",
  "mobile_responsive_unchecked",
  "accessibility_unchecked",
  "playwright_trace_present"
]);

export const VisualProofFindingSchema = z.object({
  id: VisualProofFindingIdSchema,
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string().min(1)
});

export const VisualProofAnalyzerInputSchema = z.object({
  caseId: z.string().optional(),
  task: z.string().default(""),
  changedFiles: z.array(z.string()).default([]),
  description: z.string().default(""),
  source: z.enum(["rendered_screenshot", "manual_visual_checklist", "playwright_trace", "none"]).default("none"),
  capturedAt: z.string().datetime().optional(),
  evidenceRequiredAfter: z.string().datetime().optional(),
  expectedPage: z.string().optional(),
  expectedState: z.string().optional(),
  viewport: z.string().optional(),
  checklistItems: z.array(z.string()).default([])
});

export const VisualProofAnalyzerResultSchema = z.object({
  verdict: VisualProofVerdictSchema,
  findings: z.array(VisualProofFindingSchema).min(1),
  supportsVisualClaim: z.boolean()
});

export const VisualProofFixtureCaseSchema = VisualProofAnalyzerInputSchema.extend({
  caseId: z.string().min(1),
  descriptionLabel: z.string().min(1),
  expectedVerdict: VisualProofVerdictSchema,
  expectedFindingIds: z.array(VisualProofFindingIdSchema).min(1),
  shouldCountAsStrong: z.boolean()
});

export const VisualProofFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(VisualProofFixtureCaseSchema).min(1)
});

export type VisualProofAnalyzerInput = z.input<typeof VisualProofAnalyzerInputSchema>;
export type ParsedVisualProofAnalyzerInput = z.infer<typeof VisualProofAnalyzerInputSchema>;
export type VisualProofAnalyzerResult = z.infer<typeof VisualProofAnalyzerResultSchema>;
export type VisualProofFixtureCase = z.infer<typeof VisualProofFixtureCaseSchema>;
export type VisualProofFindingId = z.infer<typeof VisualProofFindingIdSchema>;
