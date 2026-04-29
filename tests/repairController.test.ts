import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/schemas/Config.js";
import type { CompleteRequest, CompleteResponse, ModelProvider } from "../src/providers/ModelProvider.js";
import { RepairController } from "../src/validators/RepairController.js";

class ScriptedRepairProvider implements ModelProvider {
  name = "openai";
  model = "test-model";
  prompts: string[] = [];

  constructor(private response: string) {}

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    this.prompts.push(request.messages.at(-1)?.content ?? "");
    return { text: this.response };
  }
}

describe("RepairController", () => {
  it("removes unsupported claims deterministically when possible", () => {
    const result = new RepairController(1).repair(
      ["## Facts Used", "- The user is motivated.", "## Pattern Candidates", "- Unknown", "## Unknowns", "- More evidence"].join("\n"),
      ["Unsupported claim: motivated"],
      0,
      "analysis"
    );

    expect(result.attempted).toBe(true);
    expect(result.providerBacked).toBe(false);
    expect(result.repairedOutput).not.toContain("motivated");
  });

  it("uses provider-backed repair when deterministic repair is still invalid", async () => {
    const provider = new ScriptedRepairProvider(validPlan());
    const result = await new RepairController(1).repairWithProvider({
      output: "## Objective\nBuild it.",
      issues: ["Missing required heading: ## Current State"],
      mode: "planning",
      originalInput: "Plan the repair test.",
      provider,
      config: DEFAULT_CONFIG,
      evidence: ["Repo evidence was supplied."]
    });

    expect(result.pass).toBe(true);
    expect(result.providerBacked).toBe(true);
    expect(result.repairedOutput).toContain("## Evidence Required");
    expect(provider.prompts[0]).toContain("Remove unsupported claims; do not invent evidence.");
    expect(provider.prompts[0]).toContain("Do not turn unverified or skipped proof into verified proof.");
  });

  it("fails closed when provider-backed repair remains malformed", async () => {
    const result = await new RepairController(1).repairWithProvider({
      output: "## Objective\nBuild it.",
      issues: ["Missing required heading: ## Current State"],
      mode: "planning",
      originalInput: "Plan the repair failure test.",
      provider: new ScriptedRepairProvider("still bad"),
      config: DEFAULT_CONFIG
    });

    expect(result.pass).toBe(false);
    expect(result.providerBacked).toBe(true);
    expect(result.issuesRemaining.join(" ")).toContain("Missing required heading");
  });
});

function validPlan(): string {
  return [
    "## Objective",
    "Repair malformed planning output.",
    "## Current State",
    "- Original output was malformed.",
    "## Concrete Changes Required",
    "1. Restore required sections.",
    "## Files To Create Or Modify",
    "- tests/repairController.test.ts",
    "## Tests / Evals To Add",
    "- Add a dedicated repair controller test.",
    "## Commands To Run",
    "- npm run typecheck",
    "- npm test",
    "- npm run rax -- eval",
    "## Acceptance Criteria",
    "- Repair validates or fails closed.",
    "## Risks",
    "- Provider repair could invent proof.",
    "## Rollback Plan",
    "- Revert repair changes.",
    "## Evidence Required",
    "- Passing test output.",
    "## Codex Prompt",
    "Patch repair controller tests without adding authority."
  ].join("\n");
}
