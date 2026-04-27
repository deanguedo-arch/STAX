import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";

export class OperationFormatter {
  format(plan: OperationPlan, result: OperationExecutionResult): string {
    return [
      "## Operator Plan",
      `Operation: ${plan.intent}`,
      `OperationId: ${plan.operationId}`,
      `ExecutionClass: ${plan.executionClass}`,
      `Risk: ${plan.riskLevel}`,
      `Workspace: ${plan.workspace ?? "current"}`,
      `Objective: ${plan.objective}`,
      `RequiresConfirmation: ${plan.requiresConfirmation}`,
      "",
      "## Actions Run",
      result.actionsRun.length ? result.actionsRun.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Evidence Checked",
      result.evidenceChecked.length ? result.evidenceChecked.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Artifacts Created",
      result.artifactsCreated.length ? result.artifactsCreated.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Result",
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
