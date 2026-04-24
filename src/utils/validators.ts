import { z } from "zod";
import type { Mode } from "../schemas/Config.js";

export type ValidationResult = {
  valid: boolean;
  issues: string[];
};

const baseOutputSchema = z.string().min(1);

const requiredHeadings: Record<Mode, string[]> = {
  intake: ["## Signal Units", "## Unknowns"],
  analysis: ["## Facts Used", "## Pattern Candidates", "## Unknowns"],
  planning: ["## Objective", "## Plan", "## Tests / Verification"],
  audit: ["## Critic Review"],
  stax_fitness: [
    "## Signal Units",
    "## Timeline",
    "## Pattern Candidates",
    "## Deviations",
    "## Unknowns",
    "## Confidence Summary"
  ],
  code_review: ["## Findings", "## Tests", "## Residual Risk"],
  teaching: ["## Explanation", "## Example", "## Unknowns"],
  general_chat: ["## Response"]
};

const interpretationPhrases = [
  "this means",
  "probably",
  "clearly shows",
  "proves that",
  "is improving",
  "motivated",
  "undisciplined"
];

const staxForbiddenPhrases = [
  "he is clearly",
  "this proves",
  "he should",
  "he must",
  "obviously",
  "definitely",
  "in great shape",
  "disciplined person",
  "lazy",
  "unmotivated"
];

export function validateModeOutput(mode: Mode, output: string): ValidationResult {
  const parsed = baseOutputSchema.safeParse(output);
  const issues: string[] = [];

  if (!parsed.success) {
    issues.push("Output must be a non-empty string.");
  }

  for (const heading of requiredHeadings[mode]) {
    if (!output.includes(heading)) {
      issues.push(`Missing required heading: ${heading}`);
    }
  }

  if (mode === "intake" || mode === "stax_fitness") {
    const claimText = output
      .split("\n")
      .filter((line) => !line.trim().toLowerCase().startsWith("- raw input:"))
      .join("\n")
      .toLowerCase();
    if (interpretationPhrases.some((phrase) => claimText.includes(phrase))) {
      issues.push("Intake mode forbids interpretation phrases.");
    }
    if (
      mode === "stax_fitness" &&
      staxForbiddenPhrases.some((phrase) => claimText.includes(phrase))
    ) {
      issues.push("STAX fitness output contains forbidden unsupported phrasing.");
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
