import { STRATEGIC_DELIBERATION_REQUIRED_HEADINGS } from "../schemas/StrategicDeliberationOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "../validators/markdownSections.js";

export class StrategicDecisionGate {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...STRATEGIC_DELIBERATION_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );

    const options = sectionContent(output, "## Options Considered");
    const optionCount = (options.match(/^\s*(?:\d+\.|-)\s+/gm) ?? []).length;
    if (optionCount < 2) {
      issues.push("Strategic deliberation must consider at least two options.");
    }
    if (!/\bRejected\b/i.test(sectionContent(output, "## Why This Beats The Alternatives"))) {
      issues.push("Strategic deliberation must reject alternatives.");
    }
    if (!sectionContent(output, "## Opportunity Cost").trim()) {
      issues.push("Strategic deliberation must include opportunity cost.");
    }
    if (!/\b(reversible|costly_to_reverse|hard_to_reverse)\b/i.test(sectionContent(output, "## Reversibility"))) {
      issues.push("Strategic deliberation must classify reversibility.");
    }
    if (!sectionContent(output, "## Kill Criteria").trim()) {
      issues.push("Strategic deliberation must include kill criteria.");
    }
    if (!hasExecutableProofStep(sectionContent(output, "## Next Proof Step"))) {
      issues.push("Strategic deliberation must include one executable next proof step.");
    }
    const evidenceMissing = sectionContent(output, "## Evidence Missing");
    const hasMissingEvidence = evidenceMissing
      .split("\n")
      .map((line) => line.trim())
      .some((line) => line.startsWith("-") && !/^-\s+(no missing|none)/i.test(line));
    if (/\bConfidence:\s+high\b/i.test(sectionContent(output, "## Decision")) && hasMissingEvidence) {
      issues.push("Strategic deliberation cannot claim high confidence while evidence is missing.");
    }
    if (/\b(first|second|third|then|after that|finally)\b/i.test(sectionContent(output, "## Decision")) && !/\bSelect\b/i.test(sectionContent(output, "## Decision"))) {
      issues.push("Strategic deliberation must select one decision, not output only a roadmap.");
    }
    if (!/\bCapability warning|reasoning_strong|limited_mock|local_unknown\b/i.test(sectionContent(output, "## Capability Warning"))) {
      issues.push("Strategic deliberation must include provider capability warning or reasoning capability status.");
    }

    return { valid: issues.length === 0, issues };
  }
}

function hasExecutableProofStep(text: string): boolean {
  return /\b(npm run|rax |compare|run `|capture|paste back)\b/i.test(text) && !/\b(review|think about|improve)\b/i.test(text.trim());
}
