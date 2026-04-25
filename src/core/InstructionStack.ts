import type { Mode } from "../schemas/Config.js";
import { loadMarkdown } from "../utils/loadMarkdown.js";

export type InstructionStackInput = {
  userInput: string;
  mode: Mode;
  agentPrompt?: string;
  taskPrompt?: string;
  retrievedContext?: string[];
};

export type InstructionStackResult = {
  system: string;
  stack: string[];
};

const agentPromptByMode: Record<Mode, string> = {
  intake: "prompts/agents/intake_agent.md",
  analysis: "prompts/agents/analyst_agent.md",
  planning: "prompts/agents/planner_agent.md",
  audit: "prompts/agents/critic_agent.md",
  stax_fitness: "prompts/agents/intake_agent.md",
  code_review: "prompts/agents/critic_agent.md",
  teaching: "prompts/agents/analyst_agent.md",
  general_chat: "prompts/agents/analyst_agent.md",
  project_brain: "prompts/agents/analyst_agent.md",
  codex_audit: "prompts/agents/critic_agent.md",
  prompt_factory: "prompts/agents/planner_agent.md",
  test_gap_audit: "prompts/agents/critic_agent.md",
  policy_drift: "prompts/agents/critic_agent.md"
};

const taskPromptByMode: Partial<Record<Mode, string>> = {
  stax_fitness: "prompts/tasks/stax_fitness.md",
  analysis: "prompts/tasks/pattern_analysis.md",
  planning: "prompts/tasks/project_planning.md",
  audit: "prompts/tasks/audit.md",
  intake: "prompts/tasks/signal_extract.md",
  code_review: "prompts/tasks/code_review.md",
  project_brain: "prompts/tasks/project_brain.md",
  codex_audit: "prompts/tasks/codex_audit.md",
  prompt_factory: "prompts/tasks/prompt_factory.md",
  test_gap_audit: "prompts/tasks/test_gap_audit.md",
  policy_drift: "prompts/tasks/policy_drift.md"
};

export class InstructionStack {
  constructor(private rootDir = process.cwd()) {}

  async build(input: InstructionStackInput): Promise<InstructionStackResult> {
    const core = await loadMarkdown("prompts/system/rax_core.md", this.rootDir);
    const safety = await loadMarkdown("prompts/system/safety_policy.md", this.rootDir);
    const output = await loadMarkdown("prompts/system/output_contract.md", this.rootDir);
    const uncertainty = await loadMarkdown(
      "prompts/system/uncertainty_policy.md",
      this.rootDir
    );
    const agentPrompt =
      input.agentPrompt ??
      (await loadMarkdown(agentPromptByMode[input.mode], this.rootDir));
    const taskPromptPath = taskPromptByMode[input.mode];
    const taskPrompt =
      input.taskPrompt ??
      (taskPromptPath ? await loadMarkdown(taskPromptPath, this.rootDir) : "");

    const stack = [
      "# RAX Core",
      core,
      "# Safety Policy",
      safety,
      "# Output Contract",
      output,
      "# Uncertainty Policy",
      uncertainty,
      "# Agent Prompt",
      agentPrompt,
      ...(taskPrompt ? ["# Task Prompt", taskPrompt] : []),
      ...(input.retrievedContext?.length
        ? ["# Retrieved Context", input.retrievedContext.join("\n\n")]
        : [])
    ];

    return {
      system: stack.join("\n\n"),
      stack
    };
  }
}
