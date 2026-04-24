import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

export class PlannerAgent implements Agent {
  name = "planner";
  mode = "planning" as const;

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

    return {
      agent: this.name,
      schema: "planning",
      confidence: "medium",
      metadata: { providerText: providerResponse.text },
      output: [
        "## Objective",
        input.input,
        "",
        "## Assumptions",
        "- Only supplied input and retrieved context are in scope.",
        "",
        "## Plan",
        "1. Confirm inputs and constraints.",
        "2. Implement the smallest working path.",
        "3. Validate with focused tests.",
        "",
        "## Files To Create Or Modify",
        "- Unknown until implementation context is inspected.",
        "",
        "## Tests / Verification",
        "- Run the closest automated checks.",
        "",
        "## Risks",
        "- Missing context may change the plan.",
        "",
        "## Done Criteria",
        "- Tests pass and output meets the requested contract."
      ].join("\n")
    };
  }
}
