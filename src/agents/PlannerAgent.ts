import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

function boundedObjective(input: string): string {
  const cleaned = input.trim().replace(/\bfix everything\b/gi, "repair the named bounded target");
  return cleaned || "Create a bounded, evidence-backed Codex task.";
}

export class PlannerAgent implements Agent {
  name = "planner";
  mode = "planning" as const;

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

    if (input.mode === "prompt_factory") {
      return {
        agent: this.name,
        schema: "prompt_factory",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Objective",
          boundedObjective(input.input),
          "",
          "## Files To Inspect",
          "- AGENTS.md",
          "- package.json",
          "- src/cli.ts",
          "- src/utils/validators.ts",
          "- evals/regression/",
          "",
          "## Files To Modify",
          "- Only files directly required by the named mode or runtime gap.",
          "",
          "## Tests To Add",
          "- Positive test for the requested behavior.",
          "- Negative test for the main failure mode.",
          "- Regression eval fixture when output behavior changes.",
          "",
          "## Commands To Run",
          "- npm run typecheck",
          "- npm test",
          "- npm run rax -- eval",
          "",
          "## Acceptance Criteria",
          "- The change preserves existing STAX fitness behavior.",
          "- The relevant schema or validator rejects malformed output.",
          "- The CLI smoke command produces the required sections.",
          "- Command output is recorded in the final report.",
          "",
          "## Stop Conditions",
          "- Required files cannot be identified.",
          "- Typecheck, tests, or relevant evals fail.",
          "- The task would require UI, embeddings, uncontrolled shell, or new unapproved agents.",
          "",
          "## Final Report Required",
          "- Files created and modified.",
          "- Commands run and pass/fail result.",
          "- Remaining limitations and next action."
        ].join("\n")
      };
    }

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
