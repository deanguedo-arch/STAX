import { POLICY_DRIFT_REQUIRED_HEADINGS } from "../schemas/PolicyDriftOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "./markdownSections.js";

export class PolicyDriftValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...POLICY_DRIFT_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );
    const violations = sectionContent(output, "## Violations");
    const recommendation = sectionContent(output, "## Approval Recommendation").toLowerCase();

    if (recommendation.includes("approve") && violations && !/none/i.test(violations)) {
      issues.push("Policy drift output cannot approve while violations are present.");
    }

    return { valid: issues.length === 0, issues };
  }
}
