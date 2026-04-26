import type { LearningFailureType } from "../learning/LearningEvent.js";
import { AnswerQualityScorer, type AnswerQualityScore } from "./AnswerQualityScorer.js";

export type SelfAuditResult = {
  required: boolean;
  passed: boolean;
  score: AnswerQualityScore;
  failureTypes: LearningFailureType[];
  issues: string[];
  repairSuggested: boolean;
};

const SELF_AUDIT_MODES = new Set([
  "planning",
  "project_brain",
  "codex_audit",
  "learning_unit",
  "policy_drift",
  "test_gap_audit",
  "prompt_factory",
  "model_comparison"
]);

export class SelfAudit {
  audit(input: { mode: string; output: string }): SelfAuditResult {
    const required = SELF_AUDIT_MODES.has(input.mode);
    const score = new AnswerQualityScorer().score(input.mode, input.output);
    const passed = !required || score.total >= 70;
    const failureTypes: LearningFailureType[] = [];
    if (required && !passed) {
      if (score.specificity < 0.75 || score.genericOutputScore > 0.4) {
        failureTypes.push("generic_output", "weak_plan", "missing_specificity");
      }
      if (score.evidence < 0.7 || score.localProof < 0.7) failureTypes.push("eval_gap");
      if (score.testability < 0.7) failureTypes.push("missing_tests");
      if (score.riskAwareness < 0.7) failureTypes.push("policy_gap");
    }

    return {
      required,
      passed,
      score,
      failureTypes: Array.from(new Set(failureTypes)),
      issues: passed ? [] : score.reasons,
      repairSuggested: required && !passed
    };
  }
}
