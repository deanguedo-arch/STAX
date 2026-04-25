import { TEST_GAP_AUDIT_REQUIRED_HEADINGS } from "../schemas/TestGapAuditOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "./markdownSections.js";

export class TestGapAuditValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...TEST_GAP_AUDIT_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );

    const missingTests = sectionContent(output, "## Missing Tests");
    const negativeCases = sectionContent(output, "## Negative Cases Needed");
    if (!missingTests.trim()) {
      issues.push("Missing Tests must name at least one required test or state none with evidence.");
    }
    if (!negativeCases.trim()) {
      issues.push("Negative Cases Needed must name negative coverage.");
    }

    return { valid: issues.length === 0, issues };
  }
}
