import { CODEX_AUDIT_REQUIRED_HEADINGS } from "../schemas/CodexAuditOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "./markdownSections.js";

function sectionHasEvidence(section: string): boolean {
  return /\b(pass(ed)?|exit code 0|trace|eval|test|typecheck|artifact|run-\d{4}|ev_\d{3,})\b/i.test(section);
}

export class CodexAuditValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...CODEX_AUDIT_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );
    const evidenceFound = sectionContent(output, "## Evidence Found");
    const missingEvidence = sectionContent(output, "## Missing Evidence");
    const fakeCompleteFlags = sectionContent(output, "## Fake-Complete Flags");
    const recommendation = sectionContent(output, "## Approval Recommendation").toLowerCase();

    if (evidenceFound && !/none found|not supplied/i.test(evidenceFound) && !sectionHasEvidence(evidenceFound)) {
      issues.push("Evidence Found must cite concrete evidence.");
    }

    if (
      recommendation.includes("approve") &&
      (missingEvidence.length > 0 || fakeCompleteFlags.length > 0) &&
      !/none/i.test(missingEvidence + fakeCompleteFlags)
    ) {
      issues.push("Approval recommendation cannot approve when evidence is missing or fake-complete flags exist.");
    }

    return { valid: issues.length === 0, issues };
  }
}
