import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

export class AnalystAgent implements Agent {
  name = "analyst";
  mode = "analysis" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: input.input }],
      temperature: input.config.model.generationTemperature,
      top_p: input.config.model.topP,
      seed: input.config.model.seed,
      maxTokens: input.config.model.maxOutputTokens,
      timeoutMs: input.config.model.timeoutMs
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

    if (input.mode === "code_review") {
      return {
        agent: this.name,
        schema: "code_review",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Findings",
          "- No concrete code context was supplied.",
          "",
          "## Tests",
          "- Unknown",
          "",
          "## Residual Risk",
          "- Missing repository or diff context may hide issues."
        ].join("\n")
      };
    }

    if (input.mode === "teaching") {
      return {
        agent: this.name,
        schema: "teaching",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Explanation",
          input.input,
          "",
          "## Example",
          "- Unknown until more context is supplied.",
          "",
          "## Unknowns",
          "- User's current background knowledge"
        ].join("\n")
      };
    }

    if (input.mode === "general_chat") {
      return {
        agent: this.name,
        schema: "general_chat",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: ["## Response", input.input].join("\n")
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
