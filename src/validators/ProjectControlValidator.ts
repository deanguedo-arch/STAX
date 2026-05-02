import { validateProjectControlCardShape } from "../projectControl/ControlCard.js";
import { PROJECT_CONTROL_REQUIRED_HEADINGS } from "../schemas/ProjectControlOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "./markdownSections.js";

export class ProjectControlValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...PROJECT_CONTROL_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );

    issues.push(...validateProjectControlCardShape(output));

    const verified = sectionContent(output, "## Verified");
    if (/\b(tests?|build|ingest|typecheck)\s+(pass|passed|verified)\b/i.test(verified) && !/\blocal STAX command evidence\b|\bexit code 0\b|\brun-\d{4}|runs\/\d{4}/i.test(verified)) {
      issues.push("Verified runtime claims require local command evidence.");
    }

    if (/\bfix everything\b/i.test(output)) {
      issues.push("Project control output must not use broad fix-everything language.");
    }

    return { valid: issues.length === 0, issues };
  }
}
