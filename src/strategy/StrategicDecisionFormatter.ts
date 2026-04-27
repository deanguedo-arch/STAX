import type { StrategicDecision, StrategicOption } from "./StrategicQuestionSchemas.js";

export class StrategicDecisionFormatter {
  format(decision: StrategicDecision): string {
    const selected = decision.optionsConsidered.find((option) => option.optionId === decision.selectedOptionId);
    return [
      "## Strategic Question",
      `- ${decision.question}`,
      "",
      "## Capability Warning",
      providerWarning(decision),
      "",
      "## Options Considered",
      ...decision.optionsConsidered.map((option, index) => optionLine(option, index)),
      "",
      "## Best Option",
      `- ${selected?.title ?? decision.selectedOptionId}`,
      "",
      "## Why This Beats The Alternatives",
      `- ${decision.rationale}`,
      ...decision.rejectedOptions.map((item) => `- Rejected ${item.optionId}: ${item.reasonRejected}`),
      "",
      "## Red-Team Failure Modes",
      ...unique(decision.optionsConsidered.flatMap((option) => option.redTeamFailureModes)).slice(0, 5).map((item) => `- ${item}`),
      "",
      "## Opportunity Cost",
      `- ${selected?.opportunityCost ?? "Unknown opportunity cost."}`,
      "",
      "## Reversibility",
      `- ${selected?.reversibility ?? "reversible"}`,
      "",
      "## Evidence Used",
      ...bulletize(decision.evidenceUsed, "No local/project evidence was supplied."),
      "",
      "## Evidence Missing",
      ...bulletize(decision.evidenceMissing, "No missing evidence identified."),
      "",
      "## Decision",
      `- Select ${selected?.title ?? decision.selectedOptionId}. Confidence: ${decision.decisionConfidence}.`,
      "",
      "## Next Proof Step",
      `- ${decision.nextProofStep}`,
      "",
      "## Kill Criteria",
      `- ${decision.stopCondition}`,
      ...unique(selected?.killCriteria ?? []).map((item) => `- ${item}`)
    ].join("\n");
  }
}

function optionLine(option: StrategicOption, index: number): string {
  return `${index + 1}. ${option.title} (${option.optionId}) - value=${option.userValue}; cost=${option.implementationCost}; reversibility=${option.reversibility}. ${option.description}`;
}

function providerWarning(decision: StrategicDecision): string {
  if (decision.providerCapability === "reasoning_strong") {
    return "- Provider capability appears reasoning_strong; still require external benchmark proof before superiority claims.";
  }
  if (decision.providerCapability === "local_unknown") {
    return "- Capability warning: provider capability is local_unknown. Treat this as draft strategy until compared against a strong external baseline.";
  }
  return "- Capability warning: provider capability is limited_mock. Treat this as draft strategy only and compare against a strong external answer before acting.";
}

function bulletize(items: string[], fallback: string): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${fallback}`];
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}
