import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import { buildOperationReceipt, renderOperationReceipt } from "./OperationReceipt.js";
import { OperationReceiptValidator } from "./OperationReceiptValidator.js";

export class OperationFormatter {
  format(plan: OperationPlan, result: OperationExecutionResult): string {
    const receipt = buildOperationReceipt(plan, result);
    const validation = new OperationReceiptValidator().validate(receipt);
    if (!validation.valid) {
      throw new Error(`OperationReceipt validation failed: ${validation.issues.join("; ")}`);
    }
    return [
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
  }
}
