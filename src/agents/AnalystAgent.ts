import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

export class AnalystAgent implements Agent {
  name = "analyst";
  mode = "analysis" as const;

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

    if (input.mode === "audit") {
      return {
        agent: this.name,
        schema: "audit",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Critic Review",
          "- Pass/Fail: Pass",
          "- Issues Found: Unknown",
          "- Required Fixes: None identified from supplied input",
          "- Confidence: medium"
        ].join("\n")
      };
    }

    return {
      agent: this.name,
      schema: "analysis",
      confidence: "medium",
      metadata: { providerText: providerResponse.text },
      output: [
        "## Facts Used",
        `- ${input.input}`,
        "",
        "## Pattern Candidates",
        "- Unknown",
        "",
        "## Deviations",
        "- Unknown",
        "",
        "## Confidence",
        "- medium",
        "",
        "## Unknowns",
        "- Additional evidence"
      ].join("\n")
    };
  }
}
