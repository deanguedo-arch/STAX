import type { StrategicOption } from "./StrategicQuestionSchemas.js";

const valueScore = { low: 1, medium: 2, high: 3 };
const costPenalty = { low: 0, medium: 1, high: 2 };
const reversibilityScore = { reversible: 2, costly_to_reverse: 1, hard_to_reverse: 0 };

export class OptionEvaluator {
  selectBest(options: StrategicOption[]): StrategicOption {
    const [best] = [...options].sort((a, b) => this.score(b) - this.score(a));
    return best ?? options[0];
  }

  rejectedOptions(options: StrategicOption[], selectedOptionId: string): Array<{ optionId: string; reasonRejected: string }> {
    return options
      .filter((option) => option.optionId !== selectedOptionId)
      .map((option) => ({
        optionId: option.optionId,
        reasonRejected: this.rejectionReason(option)
      }));
  }

  private score(option: StrategicOption): number {
    return valueScore[option.userValue] * 3 + reversibilityScore[option.reversibility] - costPenalty[option.implementationCost];
  }

  private rejectionReason(option: StrategicOption): string {
    if (option.implementationCost === "high") {
      return "Rejected for now because its implementation cost and blast radius are too high for the current proof level.";
    }
    if (option.userValue === "low") {
      return "Rejected because it creates less direct user value than the selected option.";
    }
    if (option.evidenceAgainst.length) {
      return `Rejected because: ${option.evidenceAgainst[0]}`;
    }
    return "Rejected because it is less useful or less reversible than the selected option.";
  }
}
