import { OperationRiskGate } from "./OperationRiskGate.js";
import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";

export type OperationExecutorHandlers = {
  auditWorkspace: (plan: OperationPlan) => Promise<OperationExecutionResult>;
  judgmentDigest: (plan: OperationPlan) => Promise<OperationExecutionResult>;
  auditLastProof: (plan: OperationPlan) => Promise<OperationExecutionResult>;
};

export class OperationExecutor {
  constructor(private riskGate = new OperationRiskGate()) {}

  async execute(plan: OperationPlan, handlers: OperationExecutorHandlers): Promise<OperationExecutionResult> {
    const decision = this.riskGate.decide(plan);
    if (!decision.allowed) {
      return {
        executed: false,
        blocked: plan.executionClass === "hard_block",
        deferred: plan.executionClass === "review_only" || plan.executionClass === "requires_confirmation",
        actionsRun: [],
        artifactsCreated: [],
        evidenceChecked: ["OperationRiskGate"],
        result: this.blockedMessage(plan, decision.reason),
        risks: [decision.reason],
        nextAllowedActions: this.nextAllowedActions(plan)
      };
    }

    if (plan.intent === "audit_workspace") return handlers.auditWorkspace(plan);
    if (plan.intent === "judgment_digest") return handlers.judgmentDigest(plan);
    if (plan.intent === "audit_last_proof") return handlers.auditLastProof(plan);

    return {
      executed: false,
      blocked: false,
      deferred: false,
      actionsRun: [],
      artifactsCreated: [],
      evidenceChecked: [],
      result: "No Chat Operator operation was selected.",
      risks: [],
      nextAllowedActions: ["Continue normal chat."]
    };
  }

  private blockedMessage(plan: OperationPlan, reason: string): string {
    if (plan.executionClass === "hard_block") {
      return [
        "Blocked by Chat Operator v1A.",
        "No action was executed.",
        `Reason: ${plan.reasonCodes.join(", ") || reason}`
      ].join("\n");
    }
    if (plan.executionClass === "review_only" || plan.executionClass === "requires_confirmation") {
      return [
        "Deferred by Chat Operator v1A.",
        "No action was executed.",
        `Reason: ${plan.reasonCodes.join(", ") || reason}`
      ].join("\n");
    }
    return reason;
  }

  private nextAllowedActions(plan: OperationPlan): string[] {
    if (plan.executionClass === "hard_block") {
      return ["Use the existing explicit CLI approval/promotion path with a reason, if this is truly intended."];
    }
    if (plan.reasonCodes.includes("lab_run_deferred") || plan.reasonCodes.includes("lab_stress_deferred")) {
      return ["Use /lab go cautious 1 or CLI lab commands when you explicitly want a lab run."];
    }
    if (plan.reasonCodes.includes("eval_run_deferred")) {
      return ["Use /eval, /regression, or npm run rax -- eval explicitly."];
    }
    if (plan.reasonCodes.includes("model_comparison_deferred")) {
      return ["Use /compare external <answer> after a STAX answer is available."];
    }
    return ["Use a specific slash command or CLI command for this deferred operation."];
  }
}
