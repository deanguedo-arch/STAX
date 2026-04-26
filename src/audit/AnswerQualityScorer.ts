import { GenericOutputDetector } from "../learning/GenericOutputDetector.js";
import type { RaxMode } from "../schemas/Config.js";

export type AnswerQualityVerdict = "strong" | "usable" | "weak" | "failed";

export type AnswerQualityScore = {
  specificity: number;
  evidence: number;
  actionability: number;
  modeAdherence: number;
  localProof: number;
  testability: number;
  riskAwareness: number;
  genericOutputScore: number;
  total: number;
  verdict: AnswerQualityVerdict;
  reasons: string[];
};

const GOVERNANCE_MODES = new Set<string>([
  "planning",
  "project_brain",
  "codex_audit",
  "learning_unit",
  "policy_drift",
  "test_gap_audit",
  "prompt_factory",
  "model_comparison"
]);

export class AnswerQualityScorer {
  score(mode: string, output: string): AnswerQualityScore {
    const generic = new GenericOutputDetector().analyze(mode, output);
    const specificity = generic.qualitySignals.specificityScore;
    const evidence = this.hasEvidence(output) ? 1 : GOVERNANCE_MODES.has(mode) ? 0.35 : 0.6;
    const actionability = this.hasActionableNextStep(output) ? 1 : specificity;
    const modeAdherence = this.modeAdherence(mode, output);
    const localProof = this.hasLocalProof(output) ? 1 : mode === "codex_audit" ? 0.45 : 0.55;
    const testability = this.hasTestsOrCommands(output) ? 1 : GOVERNANCE_MODES.has(mode) ? 0.35 : 0.6;
    const riskAwareness = this.hasRiskBoundary(output) ? 1 : GOVERNANCE_MODES.has(mode) ? 0.5 : 0.7;
    const genericOutputScore = generic.qualitySignals.genericOutputScore;

    const total = Math.round(
      100 *
        (specificity * 0.18 +
          evidence * 0.15 +
          actionability * 0.14 +
          modeAdherence * 0.14 +
          localProof * 0.13 +
          testability * 0.12 +
          riskAwareness * 0.1 +
          (1 - genericOutputScore) * 0.04)
    );
    const verdict: AnswerQualityVerdict = total >= 85 ? "strong" : total >= 70 ? "usable" : total >= 50 ? "weak" : "failed";
    const reasons = [
      ...(specificity < 0.75 ? ["Specificity below current floor."] : []),
      ...(evidence < 0.7 ? ["Evidence is missing or thin."] : []),
      ...(actionability < 0.7 ? ["Actionable next step is weak."] : []),
      ...(modeAdherence < 1 ? ["Mode-required sections are missing."] : []),
      ...(localProof < 0.7 ? ["Local proof is missing or incomplete."] : []),
      ...(testability < 0.7 ? ["Tests or commands are missing."] : []),
      ...(riskAwareness < 0.7 ? ["Risk or approval boundary is weak."] : []),
      ...(genericOutputScore > 0.4 ? ["Generic-output signal is high."] : [])
    ];

    return {
      specificity,
      evidence,
      actionability,
      modeAdherence,
      localProof,
      testability,
      riskAwareness,
      genericOutputScore,
      total,
      verdict,
      reasons: reasons.length ? reasons : ["Answer quality meets the current scoring floor."]
    };
  }

  private modeAdherence(mode: string, output: string): number {
    const required: Partial<Record<RaxMode | "model_comparison", string[]>> = {
      planning: ["## Objective", "## Tests / Evals To Add", "## Commands To Run", "## Evidence Required", "## Codex Prompt"],
      project_brain: ["## Project State", "## Proven Working", "## Unproven Claims", "## Evidence Required"],
      codex_audit: ["## Audit Type", "## Evidence Checked", "## Claims Verified", "## Required Next Proof", "## Approval Recommendation"],
      learning_unit: ["## Proposed LearningEvent", "## Candidate Queues", "## Approval Required"],
      policy_drift: ["## Policy Change", "## Drift Checks", "## Violations", "## Approval Recommendation"],
      test_gap_audit: ["## Feature", "## Missing Tests", "## Negative Cases Needed", "## Eval Cases Needed"],
      prompt_factory: ["## Objective", "## Commands To Run", "## Acceptance Criteria", "## Stop Conditions"],
      model_comparison: ["## Task", "## Evidence Comparison", "## Better Answer For This Project", "## Recommended Eval"]
    };
    const headings = required[mode as RaxMode | "model_comparison"];
    if (!headings?.length) return output.trim().length > 0 ? 1 : 0;
    return headings.filter((heading) => output.includes(heading)).length / headings.length;
  }

  private hasEvidence(output: string): boolean {
    return /\b(Evidence Required|Evidence Checked|Evidence Found|Trace:|Run:|evals\/|runs\/|proof|artifact)\b/i.test(output);
  }

  private hasLocalProof(output: string): boolean {
    return /\b(runs\/\d{4}-\d{2}-\d{2}|trace\.json|learningEvent|LearningEvent|evals\/eval_results|Proof Packet|Local Evidence)\b/i.test(output);
  }

  private hasTestsOrCommands(output: string): boolean {
    return /\b(npm run typecheck|npm test|npm run rax -- eval|Tests? \/ Evals?|Commands To Run|Recommended Eval)\b/i.test(output);
  }

  private hasRiskBoundary(output: string): boolean {
    return /\b(Risks|Approval Required|Approval Recommendation|Stop Conditions|Do not|No auto|human approval|promotion)\b/i.test(output);
  }

  private hasActionableNextStep(output: string): boolean {
    return /\b(Codex Prompt|Required Fix Prompt|Next 3 Actions|Recommended Prompt|Commands To Run|Acceptance Criteria|Required Next Proof)\b/i.test(output);
  }
}
