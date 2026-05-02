import { sectionContent, sectionLines } from "../validators/markdownSections.js";

export const PROJECT_CONTROL_CARD_STATUSES = [
  "Accept",
  "Reject",
  "Provisional",
  "Human review",
  "Clean failure"
] as const;

export type ProjectControlCardStatus = (typeof PROJECT_CONTROL_CARD_STATUSES)[number];

export function projectControlStatusFromWhy(why: string): ProjectControlCardStatus {
  const lower = why.toLowerCase();
  if (lower.startsWith("clean failure")) return "Clean failure";
  if (
    /\bnot proven\b|\breject\b|\bblocked\b|\bunsafe\b|\bwrong repo\b|\bunverified\b|\bfake-complete\b/.test(lower)
  ) {
    return "Reject";
  }
  if (/\bhuman review\b/.test(lower)) return "Human review";
  if (/\bvalidated\b|\bproven\b|\baccepted\b/.test(lower) && !/\bnot proven\b/.test(lower)) {
    return "Accept";
  }
  return "Provisional";
}

export function renderProjectControlVerdictCard(why: string): string[] {
  return [
    "## Verdict",
    `- Status: ${projectControlStatusFromWhy(why)}`,
    `- Why: ${why}`
  ];
}

export function validateProjectControlCardShape(output: string): string[] {
  const issues: string[] = [];
  const verdictLines = sectionLines(output, "## Verdict");
  const verdictStatusLine = verdictLines.find((line) => /^[-*]\s*Status:\s*/i.test(line.trim()));
  const verdictWhyLine = verdictLines.find((line) => /^[-*]\s*Why:\s*/i.test(line.trim()));

  if (!verdictStatusLine) {
    issues.push("Project control output must include a Verdict status line.");
  } else {
    const status = verdictStatusLine.replace(/^[-*]\s*Status:\s*/i, "").trim();
    if (!PROJECT_CONTROL_CARD_STATUSES.includes(status as ProjectControlCardStatus)) {
      issues.push("Project control Verdict status must be Accept, Reject, Provisional, Human review, or Clean failure.");
    }
  }

  if (!verdictWhyLine) {
    issues.push("Project control output must include a Verdict why line.");
  } else if (verdictWhyLine.replace(/^[-*]\s*Why:\s*/i, "").trim().length < 12) {
    issues.push("Project control Verdict why line must explain the decision.");
  }

  const oneNextActionLines = sectionLines(output, "## One Next Action").filter((line) =>
    /^[-*\d]/.test(line.trim())
  );
  if (oneNextActionLines.length !== 1) {
    issues.push("Project control output must give exactly one next action.");
  }

  const nextAction = sectionContent(output, "## One Next Action");
  if (!/\b(run|rerun|ask|inspect|collect|discover|request|capture|audit|trace|validate|compare|send|create|provide|confirm|list|move|record|quarantine|revert|require)\b/i.test(nextAction)) {
    issues.push("Project control next action must be concrete enough to act on.");
  }

  return issues;
}
