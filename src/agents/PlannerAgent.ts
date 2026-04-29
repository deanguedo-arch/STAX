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

    if (!isMockLikeProvider(input.provider.name)) {
      return {
        agent: this.name,
        schema: input.mode,
        confidence: "medium",
        metadata: { providerText: providerResponse.text, providerBacked: true },
        output: providerResponse.text.trim()
      };
    }

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
        "## Current State",
        "- STAX is the adaptive rule-aware runtime; stax_fitness is only an explicit domain mode.",
        "- Existing behavior must stay governed by policies, schemas, critic review, validation, traces, evals, corrections, and approved memory.",
        "",
        "## Concrete Changes Required",
        "1. Identify the mode, schema, runtime, eval, and CLI surfaces touched by the requested behavior.",
        "2. Add behavior-first tests that prove the route, output contract, trace, queue, or promotion behavior.",
        "3. Implement the bounded runtime or mode change while preserving mock provider and approval gates.",
        "4. Record evidence from typecheck, tests, evals, and the relevant smoke command before claiming completion.",
        "",
        "## Files To Create Or Modify",
        "- src/core/RaxRuntime.ts",
        "- src/core/RunLogger.ts",
        "- src/utils/validators.ts",
        "- src/classifiers/ModeDetector.ts",
        "- tests/",
        "- evals/regression/",
        "",
        "## Tests / Evals To Add",
        "- Unit test for the target validator, detector, or classifier behavior.",
        "- Runtime test proving the run trace and learning/event artifacts are created when behavior changes.",
        "- Regression eval covering the user-facing mode output contract.",
        "",
        "## Commands To Run",
        "- npm run typecheck",
        "- npm test",
        "- npm run rax -- eval",
        "- npm run rax -- eval --regression",
        "",
        "## Acceptance Criteria",
        "- The output uses the requested STAX system mode and does not route general STAX prompts to stax_fitness.",
        "- The relevant validator rejects malformed or generic output.",
        "- Trace/run evidence links the behavior to an inspectable artifact.",
        "- No memory, eval, training, policy, schema, mode, config, or AGENTS update is promoted without approval.",
        "",
        "## Risks",
        "- A broad implementation can pass file-existence tests without proving behavior.",
        "- Over-broad mode terms can accidentally route general STAX prompts into a domain mode.",
        "- Promotion or retention changes can weaken replayability if source links are not preserved.",
        "",
        "## Rollback Plan",
        "- Revert the bounded mode/runtime change and keep new tests as skipped only if they document an accepted gap.",
        "- Disable new learning queue routing by config if it blocks normal runs, while preserving trace logging.",
        "",
        "## Evidence Required",
        "- Passing npm run typecheck output.",
        "- Passing npm test output.",
        "- Passing npm run rax -- eval output.",
        "- Smoke command output for the mode changed by the task.",
        "",
        "## Codex Prompt",
        "Implement this as a bounded STAX system change. Inspect the named runtime, validator, mode, eval, and test surfaces. Add behavior tests before claiming success. Preserve mock provider, approval gates, disabled shell/file-write defaults, and stax_fitness compatibility. Run npm run typecheck, npm test, npm run rax -- eval, and the relevant smoke command before reporting."
      ].join("\n")
    };
  }
}

function isMockLikeProvider(name: string): boolean {
  return name === "mock" || name.startsWith("mock-");
}
