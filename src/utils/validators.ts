import { z } from "zod";
import type { Mode } from "../schemas/Config.js";
import { CODEX_AUDIT_REQUIRED_HEADINGS } from "../schemas/CodexAuditOutput.js";
import { POLICY_DRIFT_REQUIRED_HEADINGS } from "../schemas/PolicyDriftOutput.js";
import { PROJECT_BRAIN_REQUIRED_HEADINGS } from "../schemas/ProjectBrainOutput.js";
import { PROMPT_FACTORY_REQUIRED_HEADINGS } from "../schemas/PromptFactoryOutput.js";
import { TEST_GAP_AUDIT_REQUIRED_HEADINGS } from "../schemas/TestGapAuditOutput.js";
import { LEARNING_UNIT_REQUIRED_HEADINGS } from "../schemas/LearningUnitOutput.js";
import { CodexAuditValidator } from "../validators/CodexAuditValidator.js";
import { LearningUnitValidator } from "../validators/LearningUnitValidator.js";
import { PlanningValidator } from "../validators/PlanningValidator.js";
import { PolicyDriftValidator } from "../validators/PolicyDriftValidator.js";
import { ProjectBrainValidator } from "../validators/ProjectBrainValidator.js";
import { PromptFactoryValidator } from "../validators/PromptFactoryValidator.js";
import { TestGapAuditValidator } from "../validators/TestGapAuditValidator.js";

export type ValidationResult = {
  valid: boolean;
  issues: string[];
};

const baseOutputSchema = z.string().min(1);

const requiredHeadings: Record<Mode, string[]> = {
  intake: ["## Signal Units", "## Unknowns"],
  analysis: ["## Facts Used", "## Pattern Candidates", "## Unknowns"],
  planning: [
    "## Objective",
    "## Current State",
    "## Concrete Changes Required",
    "## Files To Create Or Modify",
    "## Tests / Evals To Add",
    "## Commands To Run",
    "## Acceptance Criteria",
    "## Risks",
    "## Rollback Plan",
    "## Evidence Required",
    "## Codex Prompt"
  ],
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
  general_chat: ["## Response"],
  project_brain: [...PROJECT_BRAIN_REQUIRED_HEADINGS],
  codex_audit: [...CODEX_AUDIT_REQUIRED_HEADINGS],
  prompt_factory: [...PROMPT_FACTORY_REQUIRED_HEADINGS],
  test_gap_audit: [...TEST_GAP_AUDIT_REQUIRED_HEADINGS],
  policy_drift: [...POLICY_DRIFT_REQUIRED_HEADINGS],
  learning_unit: [...LEARNING_UNIT_REQUIRED_HEADINGS]
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

  const modeSpecific = validateGovernanceMode(mode, output);
  issues.push(...modeSpecific.issues);

  return {
    valid: issues.length === 0,
    issues
  };
}

function validateGovernanceMode(mode: Mode, output: string): ValidationResult {
  if (mode === "project_brain") return new ProjectBrainValidator().validate(output);
  if (mode === "planning") return new PlanningValidator().validate(output);
  if (mode === "learning_unit") return new LearningUnitValidator().validate(output);
  if (mode === "codex_audit") return new CodexAuditValidator().validate(output);
  if (mode === "prompt_factory") return new PromptFactoryValidator().validate(output);
  if (mode === "test_gap_audit") return new TestGapAuditValidator().validate(output);
  if (mode === "policy_drift") return new PolicyDriftValidator().validate(output);
  return { valid: true, issues: [] };
}
