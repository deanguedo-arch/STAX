import type { LearningFailureType, LearningQualitySignals } from "./LearningEvent.js";

export const PLANNING_REQUIRED_HEADINGS = [
  "## Objective",
  "## Current State",
  "## Concrete Changes Required",
  "## Files To Create Or Modify",
  "## Tests / Evals To Add",
  "## Commands To Run",
  "## Acceptance Criteria",
  "## Risks",
  "## Rollback Plan",
  "## Evidence Required",
  "## Codex Prompt"
];

const genericPhrases = [
  "confirm requirements",
  "confirm inputs",
  "identify stakeholders",
  "break into steps",
  "add tests",
  "document process",
  "review implementation",
  "ensure quality",
  "consider edge cases",
  "define success",
  "next steps",
  "gather context",
  "clarify goals",
  "outline approach",
  "smallest working path"
];

export type GenericOutputAnalysis = {
  qualitySignals: LearningQualitySignals;
  failureTypes: LearningFailureType[];
  explanation: string;
};

export class GenericOutputDetector {
  analyze(mode: string, output: string): GenericOutputAnalysis {
    const lower = output.toLowerCase();
    const forbiddenPatterns = genericPhrases.filter((phrase) => lower.includes(phrase));
    const missingSections = this.missingSections(mode, output);
    const requirementScore = this.requirementScore(mode, output, missingSections);
    const genericPenalty = Math.min(0.35, forbiddenPatterns.length * 0.07);
    const specificityScore = Math.max(0, Number((requirementScore - genericPenalty).toFixed(2)));
    const genericOutputScore = Number(Math.min(1, 1 - specificityScore + genericPenalty).toFixed(2));
    const evidenceScore = this.hasEvidence(output) ? 1 : mode === "planning" ? 0.35 : 0.6;
    const actionabilityScore = this.hasCommands(output) || this.hasCandidateQueues(output) ? 1 : specificityScore;
    const failureTypes: LearningFailureType[] = [];

    if ((mode === "planning" || mode === "analysis") && specificityScore < 0.75) {
      failureTypes.push("generic_output", "weak_plan", "missing_specificity");
    }
    if (mode === "planning" && !this.hasTests(output)) failureTypes.push("missing_tests");
    if (mode === "planning" && !this.hasFiles(output)) failureTypes.push("missing_files");

    return {
      qualitySignals: {
        genericOutputScore,
        specificityScore,
        actionabilityScore: Number(actionabilityScore.toFixed(2)),
        evidenceScore: Number(evidenceScore.toFixed(2)),
        missingSections,
        forbiddenPatterns,
        unsupportedClaims: []
      },
      failureTypes: Array.from(new Set(failureTypes)),
      explanation:
        failureTypes.length > 0
          ? `Output specificity ${specificityScore}; missing ${missingSections.join(", ") || "concrete evidence"}`
          : "Output meets the current specificity floor."
    };
  }

  private missingSections(mode: string, output: string): string[] {
    if (mode !== "planning") return [];
    return PLANNING_REQUIRED_HEADINGS.filter((heading) => !output.includes(heading));
  }

  private requirementScore(mode: string, output: string, missingSections: string[]): number {
    if (mode !== "planning") {
      return output.trim().length > 80 ? 0.8 : 0.45;
    }
    const checks = [
      missingSections.length === 0,
      this.hasFiles(output),
      this.hasTests(output),
      this.hasCommands(output),
      this.hasAcceptance(output),
      this.hasRisk(output),
      this.hasRollback(output),
      this.hasEvidence(output),
      this.hasCodexPrompt(output)
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  private sectionContent(output: string, heading: string): string {
    const start = output.indexOf(heading);
    if (start === -1) return "";
    const rest = output.slice(start + heading.length);
    const next = rest.search(/\n##\s+/);
    return (next === -1 ? rest : rest.slice(0, next)).trim();
  }

  private hasFiles(output: string): boolean {
    const content = this.sectionContent(output, "## Files To Create Or Modify").toLowerCase();
    return Boolean(content) && !/\bunknown\b/.test(content);
  }

  private hasTests(output: string): boolean {
    const content = this.sectionContent(output, "## Tests / Evals To Add").toLowerCase();
    return Boolean(content) && /\b(test|eval|regression|smoke)\b/.test(content);
  }

  private hasCommands(output: string): boolean {
    const content = this.sectionContent(output, "## Commands To Run");
    return /\bnpm run typecheck\b/.test(content) && /\bnpm test\b/.test(content);
  }

  private hasAcceptance(output: string): boolean {
    return this.sectionContent(output, "## Acceptance Criteria").length > 10;
  }

  private hasRisk(output: string): boolean {
    return this.sectionContent(output, "## Risks").length > 10;
  }

  private hasRollback(output: string): boolean {
    return this.sectionContent(output, "## Rollback Plan").length > 10;
  }

  private hasEvidence(output: string): boolean {
    return this.sectionContent(output, "## Evidence Required").length > 10;
  }

  private hasCodexPrompt(output: string): boolean {
    return this.sectionContent(output, "## Codex Prompt").length > 20;
  }

  private hasCandidateQueues(output: string): boolean {
    return /candidate queues|eval_candidate|codex_prompt_candidate/i.test(output);
  }
}

