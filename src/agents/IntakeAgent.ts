import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

function observedFact(input: string): string {
  const cleaned = input
    .replace(/^extract this as (stax )?signals?:/i, "")
    .trim();
  return cleaned || input.trim();
}

export class IntakeAgent implements Agent {
  name = "intake";
  mode = "intake" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const rawInput = input.input.trim();
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: rawInput }],
      temperature: input.config.provider.temperature,
      top_p: input.config.provider.top_p,
      seed: input.config.provider.seed,
      maxTokens: input.config.provider.maxTokens,
      timeoutMs: input.config.limits.timeoutMs
    });

    const fact = observedFact(input.input);

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
          "- Supporting context"
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
        "- Confidence: medium",
        "",
        "## Unknowns",
        "- Exact timestamp",
        "- Supporting context"
      ].join("\n")
    };
  }
}
