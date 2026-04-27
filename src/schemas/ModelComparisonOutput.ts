import { z } from "zod";

export const MODEL_COMPARISON_REQUIRED_HEADINGS = [
  "## Task",
  "## STAX Answer Strengths",
  "## External Answer Strengths",
  "## Evidence Comparison",
  "## Evidence Decision",
  "## Specificity Comparison",
  "## Actionability Comparison",
  "## Missing Local Proof",
  "## Safer Answer",
  "## Better Answer For This Project",
  "## Recommended Correction",
  "## Recommended Eval",
  "## Recommended Prompt / Patch"
] as const;

export const ModelComparisonOutputSchema = z.object({
  task: z.array(z.string()),
  staxAnswerStrengths: z.array(z.string()),
  externalAnswerStrengths: z.array(z.string()),
  evidenceComparison: z.array(z.string()),
  evidenceDecision: z.array(z.string()).optional(),
  specificityComparison: z.array(z.string()),
  actionabilityComparison: z.array(z.string()),
  missingLocalProof: z.array(z.string()),
  saferAnswer: z.array(z.string()),
  betterAnswerForThisProject: z.array(z.string()),
  recommendedCorrection: z.array(z.string()),
  recommendedEval: z.array(z.string()),
  recommendedPromptPatch: z.array(z.string())
});

export type ModelComparisonOutput = z.infer<typeof ModelComparisonOutputSchema>;
