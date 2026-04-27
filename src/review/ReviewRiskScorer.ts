import type { ReviewDisposition, ReviewRiskLevel, ReviewSource, ReviewTriageResult } from "./ReviewSchemas.js";
import { ReviewSourceSchema, ReviewTriageResultSchema } from "./ReviewSchemas.js";

const protectedTargetPatterns = [
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)rax\.config\.json$/i,
  /(^|\/)policies\//i,
  /(^|\/)schemas\//i,
  /(^|\/)modes\//i,
  /(^|\/)src\/safety\//i,
  /(^|\/)src\/validators\/CriticGate/i,
  /(^|\/)src\/learning\/PromotionGate/i,
  /(^|\/)src\/tools\//i,
  /(^|\/)memory\/approved\//i,
  /(^|\/)training\/exports\//i,
  /eval threshold/i,
  /tool permission/i,
  /provider routing/i
];

export class ReviewRiskScorer {
  score(input: ReviewSource): ReviewTriageResult {
    const source = ReviewSourceSchema.parse(input);
    const text = this.combinedText(source);
    const paths = [source.sourcePath, ...source.targetPaths, ...source.evidencePaths].filter(Boolean).join("\n");
    const reasonCodes = new Set<string>();
    const protectedTarget = protectedTargetPatterns.some((pattern) => pattern.test(paths) || pattern.test(text));
    const defensive = /\b(audit|review|assess|evaluate|defensive|prevention|governance|red[- ]?team|controls?)\b/i.test(text);
    const directActionable = /\b(how do i|how can i|tell me how to|exact bypass|exact steps|sequence|instructions)\b/i.test(text);
    const toolEnablement = /\b(unrestricted shell|enable shell|shell\s*[:=]\s*allowed|filewrite\s*[:=]\s*allowed|file write tool|git push|auto[- ]?merge)\b/i.test(text);
    const selfApproval = /\b(self[- ]?approve|approve itself|auto[- ]?approve|learning_unit.*approve|review.*promote)\b/i.test(text);
    const promotionBypass = /\b(bypass.*promotion|promotion.*bypass|ignore.*promotion gate|weaken.*promotion gate)\b/i.test(text);
    const memoryPoisoning = /\b(poison memory|memory poisoning|write.*approved memory|memory\/approved)\b/i.test(text);
    const protectedWeakening = /\b(disable.*critic|disable.*schema|weaken.*policy|weaken.*gate|auto[- ]?promote|auto[- ]?train|secret access|read \.env)\b/i.test(text);

    if (toolEnablement) reasonCodes.add("tool_enablement_attempt");
    if (selfApproval) reasonCodes.add("self_approval_attempt");
    if (promotionBypass && (directActionable || !defensive)) reasonCodes.add("promotion_bypass_attempt");
    if (memoryPoisoning && (directActionable || !defensive)) reasonCodes.add("memory_poisoning_attempt");
    if (directActionable && /(misuse|bypass|poison|exploit|exfiltrate|steal)/i.test(text)) reasonCodes.add("direct_actionable_misuse");
    if (protectedTarget && protectedWeakening) reasonCodes.add("protected_gate_weakening");

    const hardBlock = [...reasonCodes].some((code) =>
      [
        "tool_enablement_attempt",
        "self_approval_attempt",
        "promotion_bypass_attempt",
        "memory_poisoning_attempt",
        "direct_actionable_misuse",
        "protected_gate_weakening"
      ].includes(code)
    );
    if (hardBlock) {
      return this.result("hard_block", "critical", 100, "high", reasonCodes, source);
    }

    if (protectedTarget) {
      reasonCodes.add("protected_target");
      return this.result("human_review", "high", 80, "high", reasonCodes, source);
    }

    if (this.isHumanReviewSource(source, text)) {
      return this.result("human_review", "high", 75, "high", reasonCodes, source);
    }

    if (source.repeatedCount > 10) {
      reasonCodes.add("repeated_low_risk_noise");
      return this.result("human_review", "high", 72, "medium", reasonCodes, source);
    }
    if (source.repeatedCount > 5) {
      reasonCodes.add("many_similar_candidates");
      return this.result("batch_review", "medium", 45, "medium", reasonCodes, source);
    }

    if (this.isTraceOnly(source, text)) {
      reasonCodes.add("trace_only_success");
      return this.result("auto_archive", "low", 5, "high", reasonCodes, source);
    }

    if (source.riskTags.includes("duplicate") || /duplicate/i.test(text)) {
      reasonCodes.add("duplicate");
      return this.result("auto_archive", "low", 10, "medium", reasonCodes, source);
    }

    if (this.hasWeakEvidence(source)) {
      reasonCodes.add("insufficient_evidence");
      return this.result(source.synthetic ? "batch_review" : "human_review", source.synthetic ? "medium" : "high", source.synthetic ? 50 : 75, "medium", reasonCodes, source);
    }

    if (defensive && /(promotion bypass|memory poisoning|tool misuse|red[- ]?team)/i.test(text)) {
      reasonCodes.add("defensive_governance_review");
      return this.result("batch_review", "medium", 40, "medium", reasonCodes, source);
    }

    if (this.isAutoStageSource(source, text)) {
      reasonCodes.add(this.isDocsOnly(source, text) ? "low_risk_docs_candidate" : "low_risk_eval_candidate_with_strong_evidence");
      return this.result("auto_stage_for_review", "low", 25, "medium", reasonCodes, source);
    }

    if (this.isCandidateSource(source)) {
      reasonCodes.add(source.synthetic ? "low_risk_synthetic_eval_candidate" : "low_risk_correction_candidate");
      return this.result("auto_candidate", "low", 20, "medium", reasonCodes, source);
    }

    reasonCodes.add("low_signal");
    return this.result("auto_archive", "low", 15, "low", reasonCodes, source);
  }

  private combinedText(source: ReviewSource): string {
    return [
      source.sourceId,
      source.sourceType,
      source.sourcePath ?? "",
      source.targetArtifactType ?? "",
      source.reason ?? "",
      source.content ?? "",
      ...source.targetPaths,
      ...source.failureTypes,
      ...source.riskTags
    ].join("\n");
  }

  private isTraceOnly(source: ReviewSource, text: string): boolean {
    return source.approvalState === "trace_only" || source.riskTags.includes("trace_only") || /\btrace_only\b/i.test(text);
  }

  private isHumanReviewSource(source: ReviewSource, text: string): boolean {
    if (source.sourceType === "patch_proposal" || source.sourceType === "codex_handoff") return true;
    if (source.targetArtifactType && /\b(memory|training|golden|policy|schema|mode|config|provider)\b/i.test(source.targetArtifactType)) return true;
    if (/\b(memory approval|training export|golden promotion|policy patch|schema patch|mode contract|provider change)\b/i.test(text)) return true;
    return false;
  }

  private isCandidateSource(source: ReviewSource): boolean {
    return (
      source.sourceType === "lab_candidate" ||
      source.sourceType === "eval_candidate" ||
      source.sourceType === "correction" ||
      source.sourceType === "eval_pair" ||
      source.approvalState === "candidate" ||
      source.approvalState === "pending_review"
    );
  }

  private isDocsOnly(source: ReviewSource, text: string): boolean {
    const targets = source.targetPaths.length ? source.targetPaths : [source.sourcePath ?? ""];
    return targets.length > 0 && targets.every((target) => /(^|\/)docs\/|\.md$/i.test(target)) && !/AGENTS\.md/i.test(text);
  }

  private isAutoStageSource(source: ReviewSource, text: string): boolean {
    if (this.isDocsOnly(source, text) && !/policy|schema|mode|tool|promotion|memory\/approved|training\/exports/i.test(text)) return true;
    const strongEvidence = source.evidencePaths.length > 0 || /\b(trace path|runId|learningEventId|command event|rejected\/chosen)\b/i.test(text);
    return this.isCandidateSource(source) && strongEvidence && !this.isHumanReviewSource(source, text);
  }

  private hasWeakEvidence(source: ReviewSource): boolean {
    if (source.sourceType === "learning_event" && source.approvalState === "trace_only") return false;
    if (source.evidencePaths.length > 0) return false;
    if (source.sourcePath) return false;
    return !source.content?.trim();
  }

  private result(
    disposition: ReviewDisposition,
    riskLevel: ReviewRiskLevel,
    riskScore: number,
    confidence: "low" | "medium" | "high",
    reasonCodes: Set<string>,
    source: ReviewSource
  ): ReviewTriageResult {
    return ReviewTriageResultSchema.parse({
      disposition,
      riskLevel,
      riskScore,
      confidence,
      reasonCodes: Array.from(reasonCodes),
      evidencePaths: source.evidencePaths,
      requiresHuman: disposition === "human_review" || disposition === "hard_block",
      requiresReason: disposition === "human_review" || disposition === "hard_block",
      allowedActions: this.allowedActions(disposition, source)
    });
  }

  private allowedActions(disposition: ReviewDisposition, source: ReviewSource): string[] {
    if (disposition === "hard_block") return ["No automatic promotion available.", "Fix or reject the source; submit explicit new input to retry."];
    if (disposition === "human_review") return ["Review source evidence manually.", "Use existing PromotionGate commands only when appropriate."];
    if (source.sourceType === "learning_event" && source.sourceId.startsWith("learn-")) {
      return [`rax learn promote ${source.sourceId} --eval --reason "..."`, `rax learn reject ${source.sourceId} --reason "..."`];
    }
    return ["Inspect source artifact.", "No review promotion command exists."];
  }
}
