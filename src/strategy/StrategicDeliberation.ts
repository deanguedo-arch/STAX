import type { RaxConfig } from "../schemas/Config.js";
import { OptionEvaluator } from "./OptionEvaluator.js";
import { OptionGenerator } from "./OptionGenerator.js";
import { StrategicDecisionSchema, type ProviderCapability, type StrategicDecision } from "./StrategicQuestionSchemas.js";

export type StrategicDeliberationInput = {
  question: string;
  rawInput?: string;
  config: RaxConfig;
};

export class StrategicDeliberation {
  constructor(
    private optionGenerator = new OptionGenerator(),
    private optionEvaluator = new OptionEvaluator()
  ) {}

  decide(input: StrategicDeliberationInput): StrategicDecision {
    const question = input.question.trim() || "What strategic direction should STAX choose next?";
    const options = this.optionGenerator.generate(question);
    const selected = this.optionEvaluator.selectBest(options);
    const providerCapability = providerCapabilityFor(input.config);
    const evidenceUsed = evidenceUsedFor(input.rawInput ?? question);
    const evidenceMissing = evidenceMissingFor(providerCapability, input.rawInput ?? question);
    const decisionConfidence = providerCapability === "reasoning_strong" && evidenceUsed.length >= 2
      ? "medium"
      : "low";

    return StrategicDecisionSchema.parse({
      question,
      optionsConsidered: options,
      selectedOptionId: selected.optionId,
      rationale: rationaleFor(selected.optionId),
      rejectedOptions: this.optionEvaluator.rejectedOptions(options, selected.optionId),
      decisionConfidence,
      providerCapability,
      evidenceUsed,
      evidenceMissing,
      nextProofStep: nextProofFor(selected.optionId),
      stopCondition: stopConditionFor(selected.optionId)
    });
  }
}

export function providerCapabilityFor(config: RaxConfig): ProviderCapability {
  if (config.model.provider === "openai" && /gpt-5|o\d|reason/i.test(config.model.openaiModel || config.model.generationModel)) {
    return "reasoning_strong";
  }
  if (config.model.provider === "ollama") return "local_unknown";
  return "limited_mock";
}

function evidenceUsedFor(text: string): string[] {
  const evidence: string[] = [];
  if (/\b(local benchmark|problem movement|superiority gate|holdout|eval|regression|redteam|test)\b/i.test(text)) {
    evidence.push("The supplied context references local benchmark/eval/proof surfaces.");
  }
  if (/\b(user|Dean|i want|goal|better than|broad reasoning|strategy)\b/i.test(text)) {
    evidence.push("The user goal is explicitly broad reasoning, not only repo-proof reliability.");
  }
  if (/\b(repo|STAX|ChatGPT|Codex)\b/i.test(text)) {
    evidence.push("The question is tied to the STAX/ChatGPT/Codex operating context.");
  }
  return evidence;
}

function evidenceMissingFor(providerCapability: ProviderCapability, text: string): string[] {
  const missing: string[] = [];
  if (providerCapability !== "reasoning_strong") {
    missing.push("Strong reasoning-provider output or external strong-model comparison.");
  }
  if (!/\bbenchmark|external|ChatGPT|baseline|holdout\b/i.test(text)) {
    missing.push("External baseline comparison on strategy tasks.");
  }
  if (!/\bcommand|eval|test|report|trace|evidence\b/i.test(text)) {
    missing.push("Local proof artifacts for the strategic claim.");
  }
  return missing;
}

function rationaleFor(optionId: string): string {
  if (optionId === "strategic_deliberation_v0") {
    return "It directly targets the current weakness: broad strategic reasoning quality. More proof gates improve honesty, and autonomy increases action, but neither forces better option generation, tradeoffs, reversibility, or kill criteria.";
  }
  if (optionId === "strategic_benchmark_first") {
    return "It measures broad reasoning before expanding the system, but it should follow the deliberation surface so there is something strategic to measure.";
  }
  return "It is the most reversible option that still moves the strategic question forward.";
}

function nextProofFor(optionId: string): string {
  if (optionId === "strategic_deliberation_v0") {
    return "Run `npm run rax -- run --mode strategic_deliberation \"How should STAX become better than ChatGPT at broad reasoning?\"` and compare the output against an external ChatGPT baseline.";
  }
  return "Run one bounded strategy comparison and paste back the external baseline plus local evidence.";
}

function stopConditionFor(optionId: string): string {
  if (optionId === "strategic_deliberation_v0") {
    return "If strategic outputs consider fewer than three options, fail to reject alternatives, or omit kill criteria in 3 of 10 benchmark tasks, do not expand the mode.";
  }
  return "If the next proof step cannot be executed or scored, stop and redesign the strategy test.";
}
