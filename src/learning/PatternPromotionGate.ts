import type { LearningQueueType } from "./LearningEvent.js";
import {
  PatternPromotionDecisionSchema,
  PatternPromotionInputSchema,
  type PatternPromotionClassification,
  type PatternPromotionDecision,
  type PatternPromotionInput,
  type ParsedPatternPromotionInput,
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
    const promotable = isPromotable(decision.classification) && (repeated || highSeverity || input.explicitUserPreference);

    return PatternPromotionDecisionSchema.parse({
      candidateId: input.candidateId,
      classification: decision.classification,
      promotable,
      recommendedQueueType: promotable ? decision.recommendedQueueType : "trace_only",
      promotionTarget: promotable ? decision.promotionTarget : "none",
      reason: promotable
        ? decision.reason
        : `${decision.reason} It remains evidence because it is one-off, low-severity, or repo-specific.`,
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

function isPromotable(classification: PatternPromotionClassification): boolean {
  return !["trace_fact", "repo_specific_fact"].includes(classification);
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
