import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import type { OperationReceipt } from "./OperationReceipt.js";
import type { ProblemMovementResult } from "./ProblemMovementSchemas.js";
import { DirectAnswerBuilder } from "./DirectAnswerBuilder.js";
import { NextStepBuilder } from "./NextStepBuilder.js";

export type OutcomeHeader = {
  directAnswer: string;
  oneNextStep: string;
  whyThisStep: string;
  proofStatus: string;
};

export class OutcomeHeaderBuilder {
  private readonly directAnswers = new DirectAnswerBuilder();
  private readonly nextSteps = new NextStepBuilder();

  build(plan: OperationPlan, result: OperationExecutionResult, receipt: OperationReceipt): OutcomeHeader {
    return {
      directAnswer: this.directAnswers.build(plan, result),
      oneNextStep: this.nextSteps.build(plan, result),
      whyThisStep: this.nextSteps.why(plan, result),
      proofStatus: proofStatus(receipt)
    };
  }
}

export function renderOutcomeHeader(outcome: OutcomeHeader, movement: ProblemMovementResult): string {
  return [
    "## Direct Answer",
    outcome.directAnswer,
    "",
    "## One Next Step",
    `- ${outcome.oneNextStep}`,
    "",
    "## Why This Step",
    outcome.whyThisStep,
    "",
    "## Proof Status",
    outcome.proofStatus,
    `ProblemMovement: ${movement.disposition}`,
    `MovementMade: ${movement.movementMade}`,
    "RequiredEvidence:",
    ...(movement.requiredEvidence.length ? movement.requiredEvidence.map((item) => `- ${item}`) : ["- None"])
  ].join("\n");
}

function proofStatus(receipt: OperationReceipt): string {
  if (receipt.status === "blocked") return "blocked";
  if (receipt.status === "deferred" || receipt.status === "not_executed") return "deferred";
  return receipt.proofQuality === "sufficient" ? "verified" : "partial";
}
