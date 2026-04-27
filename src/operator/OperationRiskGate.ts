import type { OperationPlan } from "./OperationSchemas.js";

export type OperationRiskGateDecision = {
  allowed: boolean;
  reason: string;
};

export class OperationRiskGate {
  decide(plan: OperationPlan): OperationRiskGateDecision {
    if (plan.executionClass === "fallback") {
      return { allowed: false, reason: "No Chat Operator operation selected; use normal runtime fallback." };
    }
    if (plan.executionClass === "hard_block") {
      return { allowed: false, reason: "Operation was hard-blocked before execution." };
    }
    if (plan.executionClass === "requires_confirmation") {
      return { allowed: false, reason: "Operation requires confirmation and is outside Chat Operator v1A auto-execution." };
    }
    if (plan.executionClass === "review_only") {
      return { allowed: false, reason: "Operation is deferred to a slash command, CLI command, or later operator slice." };
    }
    return { allowed: true, reason: "Operation is allowed by Chat Operator v1A." };
  }
}
