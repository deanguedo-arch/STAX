import { GenericOutputDetector, PLANNING_REQUIRED_HEADINGS } from "../learning/GenericOutputDetector.js";
import type { ValidationResult } from "../utils/validators.js";

function sectionContent(output: string, heading: string): string {
  const start = output.indexOf(heading);
  if (start === -1) return "";
  const rest = output.slice(start + heading.length);
  const next = rest.search(/\n##\s+/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export class PlanningValidator {
  validate(output: string): ValidationResult {
    const issues: string[] = [];
    for (const heading of PLANNING_REQUIRED_HEADINGS) {
      if (!output.includes(heading)) issues.push(`Missing required heading: ${heading}`);
    }
    const files = sectionContent(output, "## Files To Create Or Modify");
    if (!files || /\bunknown\b/i.test(files)) {
      issues.push("Files To Create Or Modify must identify bounded files or file areas.");
    }
    const tests = sectionContent(output, "## Tests / Evals To Add");
    if (!/\b(test|eval|regression|smoke)\b/i.test(tests)) {
      issues.push("Tests / Evals To Add must name tests or evals.");
    }
    const commands = sectionContent(output, "## Commands To Run");
    if (!/\bnpm run typecheck\b/.test(commands)) {
      issues.push("Commands To Run must include npm run typecheck.");
    }
    if (!/\bnpm test\b/.test(commands)) {
      issues.push("Commands To Run must include npm test.");
    }
    if (!/\bnpm run rax -- eval\b/.test(commands) && /runtime|mode|schema|eval|learning/i.test(output)) {
      issues.push("Runtime/mode/schema changes must include npm run rax -- eval.");
    }
    for (const heading of ["## Acceptance Criteria", "## Risks", "## Rollback Plan", "## Evidence Required", "## Codex Prompt"]) {
      if (sectionContent(output, heading).length < 10) {
        issues.push(`${heading} must contain concrete content.`);
      }
    }
    const generic = new GenericOutputDetector().analyze("planning", output);
    if (generic.qualitySignals.specificityScore < 0.75) {
      issues.push(`Planning specificity too low: ${generic.qualitySignals.specificityScore}.`);
    }
    return { valid: issues.length === 0, issues };
  }
}

