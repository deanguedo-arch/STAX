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
    "## Unknowns"
  ]
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
    const lower = output.toLowerCase();
    if (interpretationPhrases.some((phrase) => lower.includes(phrase))) {
      issues.push("Intake mode forbids interpretation phrases.");
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
