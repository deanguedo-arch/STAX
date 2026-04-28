import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import { buildOperationReceipt, renderOperationReceipt } from "./OperationReceipt.js";
import { OperationReceiptValidator } from "./OperationReceiptValidator.js";
import { OutcomeHeaderBuilder, renderOutcomeHeader } from "./OutcomeHeaderBuilder.js";
import { ProblemMovementGate } from "./ProblemMovementGate.js";

export class OperationFormatter {
  private readonly outcomes = new OutcomeHeaderBuilder();

  format(plan: OperationPlan, result: OperationExecutionResult): string {
    const receipt = buildOperationReceipt(plan, result);
    const validation = new OperationReceiptValidator().validate(receipt);
    if (!validation.valid) {
      throw new Error(`OperationReceipt validation failed: ${validation.issues.join("; ")}`);
    }
    const outcome = this.outcomes.build(plan, result, receipt);
    const movement = new ProblemMovementGate().evaluate({
      userTask: plan.originalInput,
      intent: plan.intent,
      reasonCodes: plan.reasonCodes,
      riskLevel: plan.riskLevel,
      executionClass: plan.executionClass,
      directAnswer: outcome.directAnswer,
      oneNextStep: outcome.oneNextStep,
      whyThisStep: outcome.whyThisStep,
      proofStatus: outcome.proofStatus,
      receiptStatus: receipt.status,
      evidenceRequired: receipt.evidenceRequired,
      evidenceChecked: receipt.evidenceChecked,
      artifactsCreated: receipt.artifactsCreated,
      claimsVerified: receipt.claimsVerified.map((claim) => claim.claim),
      claimsNotVerified: receipt.claimsNotVerified,
      missingEvidence: receipt.missingEvidence,
      fakeCompleteRisks: receipt.fakeCompleteRisks,
      nextAllowedActions: receipt.nextAllowedActions,
      mutationStatus: receipt.mutationStatus,
      promotionStatus: receipt.promotionStatus
    });
    if (!movement.valid) {
      throw new Error(`ProblemMovementGate validation failed: ${movement.blockingReasons.join("; ")} Required rewrite: ${movement.requiredRewrite ?? "Rewrite the outcome header."}`);
    }
    const output = [
      renderOutcomeHeader(outcome, movement),
      "",
      "## Receipt",
      renderOperationReceipt(receipt),
      "",
      "## Result Detail",
      result.result.trim() || "- No result.",
      "",
      "## Risks / Missing Evidence",
      result.risks.length ? result.risks.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Next Allowed Action",
      result.nextAllowedActions.length ? result.nextAllowedActions.map((item) => `- ${item}`).join("\n") : "- None"
    ].join("\n");
    const markdownValidation = new OperationReceiptValidator().validateMarkdown(output);
    if (!markdownValidation.valid) {
      throw new Error(`OperationReceipt markdown validation failed: ${markdownValidation.issues.join("; ")}`);
    }
    return output;
  }
}
