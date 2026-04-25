import { PROMPT_FACTORY_REQUIRED_HEADINGS } from "../schemas/PromptFactoryOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "./markdownSections.js";

export class PromptFactoryValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...PROMPT_FACTORY_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );

    if (/\bfix everything\b/i.test(output)) {
      issues.push("Prompt factory output must be bounded and must avoid broad fix-everything language.");
    }

    if (!/\bnpm run typecheck\b/.test(sectionContent(output, "## Commands To Run"))) {
      issues.push("Commands To Run must include npm run typecheck.");
    }

    if (!/\bnpm test\b/.test(sectionContent(output, "## Commands To Run"))) {
      issues.push("Commands To Run must include npm test.");
    }

    return { valid: issues.length === 0, issues };
  }
}
