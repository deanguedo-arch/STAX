import { MODEL_COMPARISON_REQUIRED_HEADINGS } from "../schemas/ModelComparisonOutput.js";
import type { ValidationResult } from "../utils/validators.js";
import { missingHeadings, sectionContent } from "./markdownSections.js";

export class ModelComparisonValidator {
  validate(output: string): ValidationResult {
    const issues = missingHeadings(output, [...MODEL_COMPARISON_REQUIRED_HEADINGS]).map(
      (heading) => `Missing required heading: ${heading}`
    );
    if (!/\b(local proof|evidence|trace|eval|run|artifact)\b/i.test(sectionContent(output, "## Evidence Comparison"))) {
      issues.push("Evidence Comparison must discuss local proof or evidence.");
    }
    const evidenceDecision = sectionContent(output, "## Evidence Decision");
    if (!/\bDecision:\s+(verified|partial|reasoned_opinion|blocked_for_evidence)\b/i.test(evidenceDecision)) {
      issues.push("Evidence Decision must include a valid decision label.");
    }
    if (/\bDecision:\s+verified\b/i.test(evidenceDecision) && !/\b(local_command|local_trace|local_eval)\b/i.test(evidenceDecision)) {
      issues.push("Verified Evidence Decision requires local command, trace, or eval evidence class.");
    }
    if (!sectionContent(output, "## Recommended Eval").trim()) {
      issues.push("Recommended Eval must be concrete.");
    }
    if (!sectionContent(output, "## Recommended Prompt / Patch").trim()) {
      issues.push("Recommended Prompt / Patch must be concrete.");
    }
    return { valid: issues.length === 0, issues };
  }
}
