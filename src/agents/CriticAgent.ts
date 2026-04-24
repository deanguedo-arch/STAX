import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

export class CriticAgent implements Agent {
  name = "critic";
  mode = "audit" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: input.input }],
      temperature: input.config.provider.temperature,
      top_p: input.config.provider.top_p,
      seed: input.config.provider.seed,
      maxTokens: input.config.provider.maxTokens,
      timeoutMs: input.config.limits.timeoutMs
    });

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
