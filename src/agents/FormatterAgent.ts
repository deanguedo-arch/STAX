import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";
function extractPrimaryOutput(input: string): string {
  const marker = "## Primary Output";
  const start = input.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const afterMarker = input.slice(start + marker.length).replace(/^\s+/, "");
  const criticMarker = "\n## Critic Review";
  const criticStart = afterMarker.indexOf(criticMarker);
  return (criticStart === -1 ? afterMarker : afterMarker.slice(0, criticStart)).trim();
}

export class FormatterAgent implements Agent {
  name = "formatter";
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

    const primaryOutput = extractPrimaryOutput(input.input);

    return {
      agent: this.name,
      schema: "formatter",
      confidence: "high",
      metadata: { providerText: providerResponse.text },
      output: primaryOutput || input.input.trim()
    };
  }
}
