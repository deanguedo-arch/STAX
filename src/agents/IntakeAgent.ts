import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

function observedFact(input: string): string {
  const cleaned = input
    .replace(/^extract this(?: as)?\s+(stax\s+)?(fitness\s+)?signals?:/i, "")
    .replace(/^(stax\s+)?fitness\s+signals?:/i, "")
    .replace(/^stax\s*:/i, "")
    .trim();
  return cleaned || input.trim();
}

function staxObservedFact(input: string): string {
  return observedFact(input)
    .replace(/,\s*this proves.*$/i, ".")
    .replace(/\s*this proves.*$/i, "")
    .replace(/\s+right\?$/i, "")
    .trim();
}

export class IntakeAgent implements Agent {
  name = "intake";
  mode = "intake" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const rawInput = input.input.trim();
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: rawInput }],
      temperature: input.config.model.generationTemperature,
      top_p: input.config.model.topP,
      seed: input.config.model.seed,
      maxTokens: input.config.model.maxOutputTokens,
      timeoutMs: input.config.model.timeoutMs
    });

    const fact = input.mode === "stax_fitness" ? staxObservedFact(input.input) : observedFact(input.input);

    if (input.mode === "stax_fitness") {
      return {
        agent: this.name,
        schema: "stax_fitness",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Signal Units",
          "",
          "### SU-001",
          "- Type: fitness",
          "- Source: user",
          "- Timestamp: Unknown",
          `- Raw Input: ${rawInput}`,
          `- Observed Fact: ${fact}`,
          "- Inference: Unknown",
          "- Confidence: medium",
          "",
          "## Timeline",
          "- Unknown",
          "",
          "## Pattern Candidates",
          "- Unknown",
          "",
          "## Deviations",
          "- Unknown",
          "",
          "## Unknowns",
          "- Exact timestamp",
          "- Supporting context",
          "",
          "## Confidence Summary",
          "medium"
        ].join("\n")
      };
    }

    return {
      agent: this.name,
      schema: "intake",
      confidence: "medium",
      metadata: { providerText: providerResponse.text },
      output: [
        "## Signal Units",
        "",
        "### SU-001",
        "- Type: observation",
        "- Source: user",
        "- Timestamp: Unknown",
        `- Raw Input: ${rawInput}`,
        `- Observed Fact: ${fact}`,
        "- Inference: Unknown",
        "- Confidence: medium",
        "",
        "## Unknowns",
        "- Exact timestamp",
        "- Supporting context"
      ].join("\n")
    };
  }
}
