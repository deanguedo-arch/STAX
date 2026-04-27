import type { RiskScore } from "../schemas/RiskScore.js";
import type { RaxMode } from "../schemas/Config.js";

export type BoundaryMode = "allow" | "constrain" | "refuse" | "redirect";

export type BoundaryResult = {
  mode: BoundaryMode;
  reason: string;
  allowedDetailLevel: "minimal" | "brief" | "standard" | "deep" | "surgical";
};

export type BoundaryContext = {
  mode?: RaxMode;
  input?: string;
};

export class BoundaryDecision {
  constructor(
    private constrainThreshold = 5,
    private refuseThreshold = 8
  ) {}

  decide(score: RiskScore, context: BoundaryContext = {}): BoundaryResult {
    if (isDefensiveGovernanceAudit(context)) {
      return {
        mode: "constrain",
        reason: "Defensive governance audit context",
        allowedDetailLevel: "brief"
      };
    }

    if (score.privacy >= 3) {
      return {
        mode: "refuse",
        reason: "Privacy hard stop",
        allowedDetailLevel: "minimal"
      };
    }

    if (score.systemIntegrity >= 3) {
      return {
        mode: "refuse",
        reason: "System integrity hard stop",
        allowedDetailLevel: "minimal"
      };
    }

    if (score.exploitation >= 3) {
      return {
        mode: "refuse",
        reason: "Exploitation hard stop",
        allowedDetailLevel: "minimal"
      };
    }

    if (score.harm >= 3 && score.actionability >= 2) {
      return {
        mode: "refuse",
        reason: "Actionable harm hard stop",
        allowedDetailLevel: "minimal"
      };
    }

    if (score.total >= this.refuseThreshold) {
      return {
        mode: "refuse",
        reason: "High aggregate risk",
        allowedDetailLevel: "minimal"
      };
    }

    if (score.total >= this.constrainThreshold || score.regulatedAdvice >= 2) {
      return {
        mode: "constrain",
        reason: "Moderate or regulated risk",
        allowedDetailLevel: "brief"
      };
    }

    return {
      mode: "allow",
      reason: "Low risk request",
      allowedDetailLevel: "standard"
    };
  }
}

function isDefensiveGovernanceAudit(context: BoundaryContext): boolean {
  if (context.mode !== "codex_audit" && context.mode !== "policy_drift") return false;
  const text = (context.input ?? "").toLowerCase();
  if (!text.trim()) return false;

  const defensiveFraming =
    /\b(audit|review|assess|evaluate|check|inspect|analy[sz]e)\b/.test(text) &&
    /\b(governance|safety|red-?team|defensive|controls?|prevention|protections?|proposal|plan|report|policy|release gate|promotion gate|memory poisoning|tool misuse)\b/.test(text);

  if (!defensiveFraming) return false;

  const directMisuseRequest =
    /\b(tell me|tell me how to|show me how to|give me steps|step by step|walk me through|exact steps|exact sequence|exact instructions|instructions to)\b/.test(text) &&
    /\b(bypass|poison memory|memory poisoning|misuse tools?|exploit|evad(e|ing)|weaken safety|disable (critic|schema|policy))\b/.test(text);

  const embeddedActionableMisuse =
    /\b(fill in|include|provide|write|draft|generate|add)\b/.test(text) &&
    /\b(exact|actionable|steps?|instructions?|exploit|bypass|poison memory|misuse tools?|evad(e|ing))\b/.test(text) &&
    /\b(bypass|poison memory|memory poisoning|misuse tools?|exploit|evad(e|ing)|weaken safety|disable (critic|schema|policy))\b/.test(text);

  return !directMisuseRequest && !embeddedActionableMisuse;
}
