import {
  StrategyModeInputSchema,
  StrategyModeResultSchema,
  type StrategyModeInput,
  type StrategyModeResult
} from "./StrategySchemas.js";

export class StrategyMode {
  answer(input: StrategyModeInput): StrategyModeResult {
    const parsed = StrategyModeInputSchema.parse(input);
    const repoEvidenceMissing = parsed.repoSpecific && parsed.evidenceAvailable.length === 0;
    return StrategyModeResultSchema.parse({
      strategyAnswer: repoEvidenceMissing
        ? "Make the smallest reversible strategy call after collecting repo evidence."
        : "Choose one reversible experiment, name the risk it tests, and decide from observed evidence instead of confidence language.",
      assumptions: assumptionsFor(parsed),
      risks: [
        "Strategy can sound certain without being verified.",
        "A broad roadmap can hide the first experiment that would actually teach something."
      ],
      recommendedExperiment: repoEvidenceMissing
        ? "Collect the repo evidence packet first, then compare two options against that evidence."
        : "Run one bounded strategy experiment and define a kill criterion before acting broadly.",
      evidenceToCollect: repoEvidenceMissing
        ? ["package.json scripts", "relevant files or diff", "command output or user outcome evidence"]
        : ["result of the bounded experiment", "decision outcome", "what would make the strategy change"],
      proofStatus: "reasoned_strategy_not_verified"
    });
  }

  format(result: StrategyModeResult): string {
    return [
      "## Strategy Answer",
      result.strategyAnswer,
      "## Assumptions",
      ...result.assumptions.map((item) => `- ${item}`),
      "## Risks",
      ...result.risks.map((item) => `- ${item}`),
      "## Recommended Experiment",
      result.recommendedExperiment,
      "## Evidence To Collect",
      ...result.evidenceToCollect.map((item) => `- ${item}`),
      "## Proof Status",
      result.proofStatus
    ].join("\n");
  }
}

function assumptionsFor(input: ReturnType<typeof StrategyModeInputSchema.parse>): string[] {
  const assumptions = ["This is reasoning, not verified repo proof."];
  if (input.context.trim()) assumptions.push("The supplied context is treated as user-provided, not independently verified.");
  if (input.repoSpecific) assumptions.push("Repo-specific strategy needs local evidence before implementation claims.");
  return assumptions;
}
