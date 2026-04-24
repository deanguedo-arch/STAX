import type { RiskScore } from "../schemas/RiskScore.js";

export type BoundaryMode = "allow" | "constrain" | "refuse" | "redirect";

export type BoundaryResult = {
  mode: BoundaryMode;
  reason: string;
};

export class BoundaryDecision {
  constructor(
    private constrainThreshold = 5,
    private refuseThreshold = 8
  ) {}

  decide(score: RiskScore): BoundaryResult {
    if (score.privacy >= 3) {
      return {
        mode: "refuse",
        reason: "Privacy hard stop"
      };
    }

    if (score.systemIntegrity >= 3) {
      return {
        mode: "refuse",
        reason: "System integrity hard stop"
      };
    }

    if (score.exploitation >= 3) {
      return {
        mode: "refuse",
        reason: "Exploitation hard stop"
      };
    }

    if (score.harm >= 3 && score.actionability >= 2) {
      return {
        mode: "refuse",
        reason: "Actionable harm hard stop"
      };
    }

    if (score.total >= this.refuseThreshold) {
      return {
        mode: "refuse",
        reason: "High aggregate risk"
      };
    }

    if (score.total >= this.constrainThreshold || score.regulatedAdvice >= 2) {
      return {
        mode: "constrain",
        reason: "Moderate or regulated risk"
      };
    }

    return {
      mode: "allow",
      reason: "Low risk"
    };
  }
}
