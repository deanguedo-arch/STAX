import type { LearningQueueType } from "./LearningEvent.js";
import {
  PatternPromotionDecisionSchema,
  PatternPromotionInputSchema,
  type PatternPromotionAction,
  type PatternPromotionClassification,
  type PatternPromotionDecision,
  type PatternPromotionInput,
  type ParsedPatternPromotionInput,
  type PatternPromotionStrengthLabel,
  type PatternPromotionTarget
} from "./PatternPromotionSchemas.js";

type RuleDecision = {
  classification: PatternPromotionClassification;
  recommendedQueueType: LearningQueueType;
  promotionTarget: PatternPromotionTarget;
  reason: string;
  expectedFutureBehaviorChange: string;
  suggestedRegressionEval?: string;
};

export class PatternPromotionGate {
  classify(rawInput: PatternPromotionInput): PatternPromotionDecision {
    const input = PatternPromotionInputSchema.parse(rawInput);
    const normalized = normalize(input.text);
    const repeated = input.repeatCount > 1 || input.sourceEventIds.length > 1;
    const highSeverity = input.severity === "critical" || input.severity === "major";
    const decision = this.ruleFor(input, normalized, repeated, highSeverity);
    const strength = scorePromotionStrength(input, repeated, highSeverity);
    const reusable = input.reusableAcrossRepos || isReusableClassification(decision.classification);
    const singleVettedRun = input.codeChangeBacked && input.testBacked && input.realRunBacked && reusable;
    const blockers = collectBlockers(input, decision.classification, reusable);
    const boosters = collectBoosters(input, repeated, highSeverity, singleVettedRun, reusable);
    const recommendedAction = decideAction({
      input,
      classification: decision.classification,
      reusable,
      repeated,
      highSeverity,
      singleVettedRun,
      blockers,
      strengthScore: strength.score
    });
    const promotable = recommendedAction === "review_for_promotion" || recommendedAction === "promote_with_approval";

    return PatternPromotionDecisionSchema.parse({
      candidateId: input.candidateId,
      classification: decision.classification,
      recommendedAction,
      promotable,
      strengthScore: strength.score,
      strengthLabel: strength.label,
      blockers,
      boosters,
      recommendedQueueType: promotable ? decision.recommendedQueueType : "trace_only",
      promotionTarget: promotable ? decision.promotionTarget : "none",
      reason: promotable
        ? decision.reason
        : `${decision.reason} ${reasonForNonPromotion(recommendedAction, blockers)}`,
      requiredEvidence: promotable
        ? requiredEvidenceFor(input, decision.classification)
        : ["source trace", "original report or command evidence"],
      expectedFutureBehaviorChange: promotable ? decision.expectedFutureBehaviorChange : "No durable behavior change until a reusable pattern is proven.",
      suggestedRegressionEval: promotable ? decision.suggestedRegressionEval : undefined,
      autoPromote: false,
      requiresHumanApproval: true
    });
  }

  private ruleFor(input: ParsedPatternPromotionInput, text: string, repeated: boolean, highSeverity: boolean): RuleDecision {
    if (input.explicitUserPreference) {
      return {
        classification: "user_preference",
        recommendedQueueType: "memory_candidate",
        promotionTarget: "memory",
        reason: "Explicit durable user preference may become reviewed memory.",
        expectedFutureBehaviorChange: "Future answers can honor the durable preference without inferring it from tone."
      };
    }

    if (isPolicySafetyRule(text)) {
      return {
        classification: "policy_safety_rule",
        recommendedQueueType: "policy_patch_candidate",
        promotionTarget: "policy_patch",
        reason: "Publish, sync, deploy, or release boundaries are safety-sensitive workflow rules.",
        expectedFutureBehaviorChange: "Future publish/sync answers require preflight, target validation, and explicit scope checks.",
        suggestedRegressionEval: "A publish/sync request without target validation must be blocked or downgraded to a preflight step."
      };
    }

    if (isSchemaContractRule(text)) {
      return {
        classification: "schema_contract_rule",
        recommendedQueueType: "schema_patch_candidate",
        promotionTarget: "schema_patch",
        reason: "The candidate describes a structured contract weakness rather than a single result.",
        expectedFutureBehaviorChange: "Future outputs are validated against the stronger schema contract.",
        suggestedRegressionEval: "Malformed structured output should fail schema validation instead of passing silently."
      };
    }

    if (isCodexHandoffRule(text)) {
      return {
        classification: "codex_handoff_rule",
        recommendedQueueType: "codex_prompt_candidate",
        promotionTarget: "mode_contract_patch",
        reason: "Reusable Codex handoff shape can improve future bounded delegation prompts.",
        expectedFutureBehaviorChange: "Future Codex prompts include repo path, files, commands, acceptance criteria, and stop conditions.",
        suggestedRegressionEval: "A bounded Codex prompt request should include scope, evidence command, acceptance criteria, and stop condition."
      };
    }

    if (isVisualProofRule(text)) {
      return {
        classification: "mode_behavior_rule",
        recommendedQueueType: "mode_contract_patch_candidate",
        promotionTarget: "mode_contract_patch",
        reason: "Visual proof requirements change mode behavior, not repo trivia.",
        expectedFutureBehaviorChange: "Future visual/layout completion claims require rendered evidence, not source diffs alone.",
        suggestedRegressionEval: "A visual fix report with only CSS diff evidence must be marked unverified."
      };
    }

    if (input.failureTypes.includes("missing_specificity") && repeated) {
      return {
        classification: "cross_repo_pattern",
        recommendedQueueType: "eval_candidate",
        promotionTarget: "eval",
        reason: "Repeated missing-specificity failures are reusable across repos.",
        expectedFutureBehaviorChange: "Future reports lacking file list, diff, and command output are treated as unverified.",
        suggestedRegressionEval: "A Codex report with no file list, diff, or command output must be rejected as fake-complete risk."
      };
    }

    if (isProofBoundaryRule(text)) {
      return {
        classification: "proof_boundary_rule",
        recommendedQueueType: "eval_candidate",
        promotionTarget: "eval",
        reason: "The candidate defines a reusable proof boundary that should be replay-tested.",
        expectedFutureBehaviorChange: "Future answers reject weak proof and demand target-repo command evidence.",
        suggestedRegressionEval: regressionHint(text)
      };
    }

    if (input.failureTypes.includes("command_failure") && !repeated && !highSeverity) {
      return {
        classification: "trace_fact",
        recommendedQueueType: "trace_only",
        promotionTarget: "none",
        reason: "Single low-severity command failures are evidence for the run, not learning.",
        expectedFutureBehaviorChange: "No behavior change; collect more evidence before promotion."
      };
    }

    if (isRepoSpecificFact(text)) {
      return {
        classification: "repo_specific_fact",
        recommendedQueueType: "trace_only",
        promotionTarget: "none",
        reason: "Specific file, package, command, or local state facts are evidence, not durable learning.",
        expectedFutureBehaviorChange: "No behavior change; preserve as trace evidence only."
      };
    }

    if (repeated || highSeverity) {
      return {
        classification: "cross_repo_pattern",
        recommendedQueueType: "eval_candidate",
        promotionTarget: "eval",
        reason: "Repeated or high-severity behavior can become a reusable evaluation candidate.",
        expectedFutureBehaviorChange: "Future tasks are checked against the repeated failure pattern.",
        suggestedRegressionEval: "Replay a similar task and assert STAX chooses a bounded, evidence-backed next action."
      };
    }

    return {
      classification: "trace_fact",
      recommendedQueueType: "trace_only",
      promotionTarget: "none",
      reason: "This is a one-off observation.",
      expectedFutureBehaviorChange: "No behavior change; preserve as trace evidence only."
    };
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isReusableClassification(classification: PatternPromotionClassification): boolean {
  return !["trace_fact", "repo_specific_fact"].includes(classification);
}

function scorePromotionStrength(
  input: ParsedPatternPromotionInput,
  repeated: boolean,
  highSeverity: boolean
): { score: number; label: PatternPromotionStrengthLabel } {
  let score = 0;
  if (repeated) score += 2;
  if (highSeverity) score += 2;
  if (input.explicitUserPreference) score += 3;
  if (input.codeChangeBacked) score += 2;
  if (input.testBacked) score += 2;
  if (input.realRunBacked) score += 2;
  if (input.reusableAcrossRepos) score += 2;
  if (input.humanApproved) score += 1;
  if (input.repoScoped) score -= 1;
  score = Math.max(0, Math.min(10, score));
  return {
    score,
    label: score >= 8 ? "vetted" : score >= 6 ? "strong" : score >= 3 ? "moderate" : "weak"
  };
}

function collectBlockers(
  input: ParsedPatternPromotionInput,
  classification: PatternPromotionClassification,
  reusable: boolean
): string[] {
  const blockers: string[] = [];
  if (classification === "trace_fact") blockers.push("one-off trace only");
  if (classification === "repo_specific_fact") blockers.push("repo-specific fact");
  if (input.repoScoped && !reusable) blockers.push("scoped to one repo");
  if (!input.testBacked && !input.explicitUserPreference) blockers.push("no test backing");
  if (!input.realRunBacked && !input.explicitUserPreference) blockers.push("no real-run backing");
  if (!reusable && classification !== "trace_fact" && classification !== "repo_specific_fact") blockers.push("reusability not established");
  return blockers;
}

function collectBoosters(
  input: ParsedPatternPromotionInput,
  repeated: boolean,
  highSeverity: boolean,
  singleVettedRun: boolean,
  reusable: boolean
): string[] {
  const boosters: string[] = [];
  if (repeated) boosters.push("repeated pattern evidence");
  if (highSeverity) boosters.push("high-severity failure");
  if (input.codeChangeBacked) boosters.push("code-change backed");
  if (input.testBacked) boosters.push("test backed");
  if (input.realRunBacked) boosters.push("real-run backed");
  if (reusable) boosters.push("cross-repo reusable");
  if (input.humanApproved) boosters.push("human approved");
  if (singleVettedRun) boosters.push("single vetted run");
  return boosters;
}

function decideAction(options: {
  input: ParsedPatternPromotionInput;
  classification: PatternPromotionClassification;
  reusable: boolean;
  repeated: boolean;
  highSeverity: boolean;
  singleVettedRun: boolean;
  blockers: string[];
  strengthScore: number;
}): PatternPromotionAction {
  const { input, classification, reusable, repeated, highSeverity, singleVettedRun, blockers, strengthScore } = options;
  if (classification === "trace_fact") return "discard";
  if (classification === "repo_specific_fact") return "hold_local";
  if (input.explicitUserPreference) {
    return input.humanApproved ? "promote_with_approval" : "review_for_promotion";
  }
  if (blockers.includes("repo-specific fact")) return "hold_local";
  if (reusable && (repeated || highSeverity)) {
    return input.humanApproved ? "promote_with_approval" : "review_for_promotion";
  }
  if (singleVettedRun && strengthScore >= 6) {
    return input.humanApproved ? "promote_with_approval" : "review_for_promotion";
  }
  if (reusable && strengthScore >= 7) {
    return input.humanApproved ? "promote_with_approval" : "review_for_promotion";
  }
  return "hold_local";
}

function reasonForNonPromotion(action: PatternPromotionAction, blockers: string[]): string {
  if (action === "discard") return "It remains trace evidence because it is one-off and not reusable.";
  if (action === "hold_local") {
    return blockers.length > 0
      ? `It remains local evidence for now because ${blockers.join(", ")}.`
      : "It remains local evidence until reusability is clearer.";
  }
  return "It still requires human approval before promotion.";
}

function isProofBoundaryRule(text: string): boolean {
  return (
    /seed-gold|ingest proof|wrong repo|target repo|command output|codex report lacks|file list|diff|fake-complete|fake complete|unsupported claim/.test(
      text
    ) || (/proof/.test(text) && /command|repo|evidence|claim/.test(text))
  );
}

function isVisualProofRule(text: string): boolean {
  return /css diff|visual proof|rendered screenshot|layout fix|browser evidence|rendered evidence/.test(text);
}

function isPolicySafetyRule(text: string): boolean {
  return /publish|sync|deploy|release|push/.test(text) && /preflight|target validation|target validate|scope/.test(text);
}

function isSchemaContractRule(text: string): boolean {
  return /schema|contract|validator|validation/.test(text) && /patch|weakness|malformed|silently pass|fail/.test(text);
}

function isCodexHandoffRule(text: string): boolean {
  return /codex/.test(text) && /handoff|prompt|stop condition|acceptance criteria|files to inspect|repo path/.test(text);
}

function isRepoSpecificFact(text: string): boolean {
  return (
    /package-lock|specific test|this exact file|file existed|changed once|command passed once|local node_modules|tmp\\|tmp\//.test(text) ||
    (/\b(src|tests|docs|package-lock|package\.json)\b/.test(text) && !isProofBoundaryRule(text))
  );
}

function requiredEvidenceFor(input: ParsedPatternPromotionInput, classification: PatternPromotionClassification): string[] {
  const evidence = ["source events", "source report or trace", "human approval"];
  if (input.repeatCount > 1 || input.sourceEventIds.length > 1) evidence.push("repeatability evidence");
  if (input.codeChangeBacked) evidence.push("code change backing");
  if (input.testBacked) evidence.push("test backing");
  if (input.realRunBacked) evidence.push("real run backing");
  if (classification !== "user_preference") evidence.push("expected future behavior change");
  if (["proof_boundary_rule", "mode_behavior_rule", "policy_safety_rule", "schema_contract_rule"].includes(classification)) {
    evidence.push("regression eval if possible");
  }
  return evidence;
}

function regressionHint(text: string): string {
  if (/seed-gold/.test(text)) return "A seed-gold run without build and ingest:ci must not prove ingest repair.";
  if (/wrong repo|target repo/.test(text)) return "Command evidence from the wrong repo must not verify the target repo.";
  if (/codex report lacks|file list|diff/.test(text)) {
    return "A Codex report lacking file list, diff, and command output must be treated as unverified.";
  }
  return "A weak proof claim should be downgraded until target command evidence is supplied.";
}
