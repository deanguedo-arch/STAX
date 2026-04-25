import { PROJECT_BRAIN_REQUIRED_HEADINGS } from "../schemas/ProjectBrainOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionLines } from "./markdownSections.js";

const evidenceIdPattern = /\bev_\d{3,}\b/i;

function isEmptyAllowance(line: string): boolean {
  return /^-\s+(none|no evidence-backed|no approved|not supplied)/i.test(line);
}

export class ProjectBrainValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...PROJECT_BRAIN_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );
    const provenLines = sectionLines(output, "## Proven Working").filter((line) =>
      line.startsWith("-")
    );

    for (const line of provenLines) {
      if (!isEmptyAllowance(line) && !evidenceIdPattern.test(line)) {
        issues.push(`Proven Working claim lacks evidence ID: ${line}`);
      }
    }

    const codexPromptLines = sectionLines(output, "## Codex Prompt");
    if (codexPromptLines.some((line) => /fix everything/i.test(line))) {
      issues.push("Codex Prompt must be surgical and must not ask Codex to fix everything.");
    }

    return { valid: issues.length === 0, issues };
  }
}
