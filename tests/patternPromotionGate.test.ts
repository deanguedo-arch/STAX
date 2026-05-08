import { describe, expect, it } from "vitest";
import { PatternPromotionGate } from "../src/learning/PatternPromotionGate.js";

const gate = new PatternPromotionGate();

describe("PatternPromotionGate", () => {
  it("keeps Brightspace package-lock facts as trace-only repo-specific facts", () => {
    const result = gate.classify({
      candidateId: "package-lock-fact",
      text: "In brightspacequizexporter, package-lock.json changed after npm install.",
      sourceEventIds: ["evt-1"],
      repo: "brightspacequizexporter"
    });

    expect(result.classification).toBe("repo_specific_fact");
    expect(result.promotable).toBe(false);
    expect(result.recommendedQueueType).toBe("trace_only");
    expect(result.reason).toContain("one-off");
  });

  it("turns seed-gold-is-not-ingest-proof into a proof-boundary eval candidate", () => {
    const result = gate.classify({
      candidateId: "seed-gold-proof",
      text: "seed-gold is not proof of ingest repair; run npm run build and npm run ingest:ci before claiming ingest fixed.",
      sourceEventIds: ["evt-1", "evt-2"],
      failureTypes: ["unsupported_claim"],
      repeatCount: 2
    });

    expect(result.classification).toBe("proof_boundary_rule");
    expect(result.promotable).toBe(true);
    expect(result.recommendedQueueType).toBe("eval_candidate");
    expect(result.promotionTarget).toBe("eval");
    expect(result.requiredEvidence).toContain("source events");
    expect(result.expectedFutureBehaviorChange).toContain("proof");
    expect(result.suggestedRegressionEval).toContain("seed-gold");
  });

  it("turns wrong-repo command evidence into a proof-boundary eval candidate", () => {
    const result = gate.classify({
      candidateId: "wrong-repo-proof",
      text: "wrong repo command output must not verify target repo; canvas-helper build output cannot prove brightspacequizexporter.",
      sourceEventIds: ["evt-1"],
      severity: "critical"
    });

    expect(result.classification).toBe("proof_boundary_rule");
    expect(result.promotable).toBe(true);
    expect(result.recommendedQueueType).toBe("eval_candidate");
    expect(result.promotionTarget).toBe("eval");
  });

  it("turns CSS diff is not visual proof into a mode contract patch candidate", () => {
    const result = gate.classify({
      candidateId: "visual-proof",
      text: "CSS diff is not visual proof; visual/layout fixes require rendered screenshot or browser evidence.",
      sourceEventIds: ["evt-1", "evt-2"],
      repeatCount: 2
    });

    expect(result.classification).toBe("mode_behavior_rule");
    expect(result.promotable).toBe(true);
    expect(result.recommendedQueueType).toBe("mode_contract_patch_candidate");
    expect(result.promotionTarget).toBe("mode_contract_patch");
  });

  it("turns publish/sync preflight requirements into a policy safety rule", () => {
    const result = gate.classify({
      candidateId: "publish-sync",
      text: "publish/sync requires preflight and target validation before deploy, push, or release.",
      sourceEventIds: ["evt-1"],
      severity: "critical"
    });

    expect(result.classification).toBe("policy_safety_rule");
    expect(result.promotable).toBe(true);
    expect(result.recommendedQueueType).toBe("policy_patch_candidate");
    expect(result.promotionTarget).toBe("policy_patch");
  });

  it("allows durable user preferences as memory candidates only when explicit", () => {
    const explicit = gate.classify({
      candidateId: "durable-pref",
      text: "Dean prefers high-flux dieting.",
      sourceEventIds: ["evt-1"],
      explicitUserPreference: true
    });
    const inferred = gate.classify({
      candidateId: "inferred-pref",
      text: "Dean seemed annoyed by the result.",
      sourceEventIds: ["evt-1"]
    });

    expect(explicit.classification).toBe("user_preference");
    expect(explicit.promotable).toBe(true);
    expect(explicit.recommendedQueueType).toBe("memory_candidate");
    expect(explicit.promotionTarget).toBe("memory");
    expect(inferred.promotable).toBe(false);
    expect(inferred.recommendedQueueType).toBe("trace_only");
  });

  it("routes reusable Codex handoff prompt shape to codex_prompt_candidate", () => {
    const result = gate.classify({
      candidateId: "codex-handoff",
      text: "Codex handoff prompt should include repo path, files to inspect, exact commands, acceptance criteria, and stop condition.",
      sourceEventIds: ["evt-1", "evt-2"],
      repeatCount: 2
    });

    expect(result.classification).toBe("codex_handoff_rule");
    expect(result.promotable).toBe(true);
    expect(result.recommendedQueueType).toBe("codex_prompt_candidate");
    expect(result.promotionTarget).toBe("mode_contract_patch");
  });

  it("keeps single low-severity one-off command failures out of promotion", () => {
    const result = gate.classify({
      candidateId: "one-off-command",
      text: "npm run build failed once because local node_modules was missing.",
      sourceEventIds: ["evt-1"],
      failureTypes: ["command_failure"],
      severity: "minor"
    });

    expect(result.classification).toBe("trace_fact");
    expect(result.promotable).toBe(false);
    expect(result.recommendedQueueType).toBe("trace_only");
  });

  it("routes repeated missing-specificity failures to eval_candidate", () => {
    const result = gate.classify({
      candidateId: "missing-specificity",
      text: "Repeated missing-specificity failures: Codex reports lacked file list, diff, and command output.",
      sourceEventIds: ["evt-1", "evt-2", "evt-3"],
      failureTypes: ["missing_specificity"],
      repeatCount: 3
    });

    expect(result.classification).toBe("cross_repo_pattern");
    expect(result.promotable).toBe(true);
    expect(result.recommendedQueueType).toBe("eval_candidate");
    expect(result.promotionTarget).toBe("eval");
  });

  it("never auto-promotes even when candidate is promotable", () => {
    const result = gate.classify({
      candidateId: "fake-complete",
      text: "When a Codex report lacks file list, diff, and command output, treat it as unverified.",
      sourceEventIds: ["evt-1", "evt-2"],
      repeatCount: 2
    });

    expect(result.promotable).toBe(true);
    expect(result.autoPromote).toBe(false);
    expect(result.requiresHumanApproval).toBe(true);
  });
});
