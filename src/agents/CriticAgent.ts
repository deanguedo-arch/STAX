import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

export class CriticAgent implements Agent {
  name = "critic";
  mode = "audit" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: input.input }],
      temperature: input.config.model.criticTemperature,
      top_p: input.config.model.topP,
      seed: input.config.model.seed,
      maxTokens: input.config.model.maxOutputTokens,
      timeoutMs: input.config.model.timeoutMs
    });

    if (!isMockLikeProvider(input.provider.name)) {
      return {
        agent: this.name,
        schema: "critic",
        confidence: "medium",
        metadata: { providerText: providerResponse.text, providerBacked: true },
        output: providerResponse.text.trim()
      };
    }

    const issues = /probably|clearly shows|proves that/i.test(input.input)
      ? "Potential unsupported interpretation."
      : "None identified.";

    return {
      agent: this.name,
      schema: "critic",
      confidence: "medium",
      metadata: { providerText: providerResponse.text },
      output: [
        "## Critic Review",
        "- Pass/Fail: Pass",
        `- Issues Found: ${issues}`,
        "- Required Fixes: None",
        "- Confidence: medium"
      ].join("\n")
    };
  }
}

function isMockLikeProvider(name: string): boolean {
  return name === "mock" || name.startsWith("mock-");
}
