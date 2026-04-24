import type { Mode } from "../schemas/Config.js";
import { validateModeOutput } from "../utils/validators.js";

export type CriticReview = {
  pass: boolean;
  severity: "none" | "minor" | "major" | "critical";
  issuesFound: string[];
  requiredFixes: string[];
  policyViolations: string[];
  schemaIssues: string[];
  unsupportedClaims: string[];
  forbiddenPhrases: string[];
  confidence: "low" | "medium" | "high";
};

export type CriticGateInput = {
  mode: Mode;
  output: string;
  formattedOutput?: string;
};

const forbiddenStaxPhrases = [
  "he is clearly",
  "this proves",
  "he should",
  "he must",
  "obviously",
  "definitely",
  "in great shape",
  "disciplined person",
  "lazy",
  "unmotivated",
  "motivated",
  "consistent person",
  "not committed"
];

const unsupportedPatterns = [
  "disciplined person",
  "in great shape",
  "not committed",
  "motivated",
  "lazy",
  "unmotivated"
];

export class CriticGate {
  pass(review: CriticReview): boolean {
    return review.pass && review.policyViolations.length === 0 && review.schemaIssues.length === 0;
  }

  review(input: CriticGateInput): CriticReview {
    const validation = validateModeOutput(input.mode, input.output);
    const lower = input.output.toLowerCase();
    const forbiddenPhrases =
      input.mode === "stax_fitness"
        ? forbiddenStaxPhrases.filter((phrase) => lower.includes(phrase))
        : [];
    const unsupportedClaims = unsupportedPatterns.filter((phrase) => lower.includes(phrase));
    const schemaIssues = validation.issues;
    const policyViolations: string[] = [];

    if (forbiddenPhrases.length > 0) {
      policyViolations.push("stax_fitness_forbidden_phrase");
    }

    if (input.mode === "stax_fitness" && /\b(should|must)\b/i.test(input.output)) {
      policyViolations.push("stax_no_coaching");
    }

    if (input.formattedOutput && input.formattedOutput.length > input.output.length * 1.5) {
      policyViolations.push("formatter_added_possible_claims");
    }

    const issuesFound = [
      ...schemaIssues,
      ...policyViolations,
      ...unsupportedClaims.map((claim) => `Unsupported claim: ${claim}`)
    ];

    const severity =
      policyViolations.some((issue) => issue.includes("safety")) ? "critical" :
      policyViolations.length > 0 || unsupportedClaims.length > 0 || schemaIssues.length > 0 ? "major" :
      "none";

    return {
      pass: issuesFound.length === 0,
      severity,
      issuesFound,
      requiredFixes: issuesFound.map((issue) => `Fix: ${issue}`),
      policyViolations,
      schemaIssues,
      unsupportedClaims,
      forbiddenPhrases,
      confidence: "high"
    };
  }
}
