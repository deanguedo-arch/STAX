import { LEARNING_UNIT_REQUIRED_HEADINGS } from "../schemas/LearningUnitOutput.js";
import type { ValidationResult } from "../utils/validators.js";

function sectionContent(output: string, heading: string): string {
  const start = output.indexOf(heading);
  if (start === -1) return "";
  const rest = output.slice(start + heading.length);
  const next = rest.search(/\n##\s+/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export class LearningUnitValidator {
  validate(output: string): ValidationResult {
    const issues: string[] = [];
    for (const heading of LEARNING_UNIT_REQUIRED_HEADINGS) {
      if (!output.includes(heading)) issues.push(`Missing required heading: ${heading}`);
    }
    if (!/eval_candidate|mode_contract_patch_candidate|codex_prompt_candidate|trace_only|correction_candidate/i.test(sectionContent(output, "## Candidate Queues"))) {
      issues.push("Candidate Queues must include concrete queue names.");
    }
    if (!/approval required|requires explicit approval|pending review/i.test(sectionContent(output, "## Approval Required"))) {
      issues.push("Approval Required must state that promotion requires explicit approval.");
    }
    if (/auto-?promote|autonomous self-learning/i.test(output)) {
      issues.push("Learning unit must not claim autonomous promotion or self-learning.");
    }
    return { valid: issues.length === 0, issues };
  }
}

