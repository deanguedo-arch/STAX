import { z } from "zod";

export const ModelCriticReviewSchema = z.object({
  pass: z.boolean(),
  severity: z.enum(["none", "minor", "major", "critical"]).default("none"),
  reasoningQuality: z.enum(["strong", "adequate", "weak", "missing"]).default("adequate"),
  evidenceQuality: z.enum(["strong", "adequate", "weak", "missing"]).default("adequate"),
  unsupportedClaims: z.array(z.string()).default([]),
  inventedSpecifics: z.array(z.string()).default([]),
  fakeCompleteRisk: z.array(z.string()).default([]),
  missingNextAction: z.array(z.string()).default([]),
  policyViolations: z.array(z.string()).default([]),
  requiredFixes: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium")
});

export type ModelCriticReview = z.infer<typeof ModelCriticReviewSchema>;

export function parseModelCriticReview(text: string): ModelCriticReview | null {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    const result = ModelCriticReviewSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function renderModelCriticReview(review: ModelCriticReview): string {
  return [
    "## Critic Review",
    `- Pass/Fail: ${review.pass ? "Pass" : "Fail"}`,
    `- Severity: ${review.severity}`,
    `- Reasoning Quality: ${review.reasoningQuality}`,
    `- Evidence Quality: ${review.evidenceQuality}`,
    `- Unsupported Claims: ${formatList(review.unsupportedClaims)}`,
    `- Invented Specifics: ${formatList(review.inventedSpecifics)}`,
    `- Fake-Complete Risk: ${formatList(review.fakeCompleteRisk)}`,
    `- Missing Next Action: ${formatList(review.missingNextAction)}`,
    `- Policy Violations: ${formatList(review.policyViolations)}`,
    `- Required Fixes: ${formatList(review.requiredFixes)}`,
    `- Confidence: ${review.confidence}`,
    "",
    "## Structured Critic Review",
    "```json",
    JSON.stringify(review, null, 2),
    "```"
  ].join("\n");
}

export function modelCriticIssuesFromReview(review: ModelCriticReview): string[] {
  if (review.pass) return [];
  const issues = [
    ...review.unsupportedClaims.map((item) => `unsupported claim: ${item}`),
    ...review.inventedSpecifics.map((item) => `invented specific: ${item}`),
    ...review.fakeCompleteRisk.map((item) => `fake-complete risk: ${item}`),
    ...review.missingNextAction.map((item) => `missing next action: ${item}`),
    ...review.policyViolations.map((item) => `policy violation: ${item}`),
    ...review.requiredFixes.map((item) => `required fix: ${item}`)
  ].filter(Boolean);

  if (issues.length) return issues.map((issue) => `Model critic failure: ${issue}`);
  return [`Model critic failure: structured review failed with severity ${review.severity}.`];
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced?.startsWith("{")) return fenced;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function formatList(items: string[]): string {
  return items.length ? items.join("; ") : "None";
}
