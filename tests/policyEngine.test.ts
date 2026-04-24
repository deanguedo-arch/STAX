import { describe, expect, it } from "vitest";
import { PolicyCompiler } from "../src/policy/PolicyCompiler.js";
import { ConflictResolver } from "../src/policy/ConflictResolver.js";
import { PolicyLoader } from "../src/policy/PolicyLoader.js";
import { PolicySelector } from "../src/policy/PolicySelector.js";
import type { RiskScore } from "../src/schemas/RiskScore.js";

const lowRisk: RiskScore = {
  intent: 0,
  harm: 0,
  actionability: 0,
  privacy: 0,
  exploitation: 0,
  regulatedAdvice: 0,
  systemIntegrity: 0,
  total: 0,
  labels: []
};

describe("policy engine", () => {
  it("selects focused policies by mode", async () => {
    const selector = new PolicySelector();
    const selected = selector.select({
      mode: "stax_fitness",
      boundaryMode: "allow",
      risk: lowRisk
    });

    expect(selected).toEqual(
      expect.arrayContaining([
        "core_policy",
        "evidence_policy",
        "uncertainty_policy",
        "privacy_policy",
        "mode_policy"
      ])
    );
    expect(selected).not.toContain("tool_policy");
  });

  it("compiles a policy bundle from selected markdown files", async () => {
    const loader = new PolicyLoader(process.cwd());
    const compiler = new PolicyCompiler(loader, new PolicySelector());
    const bundle = await compiler.compile({
      mode: "planning",
      risk: lowRisk,
      boundaryMode: "allow",
      userInput: "Build a project plan.",
      retrievedMemory: [],
      retrievedExamples: []
    });

    expect(bundle.policiesApplied).toContain("core_policy@1.0.0");
    expect(bundle.compiledSystemPrompt).toContain("# RAX Core");
    expect(bundle.outputContract).toContain("planning");
    expect(bundle.forbiddenBehaviors).toContain("invent facts");
  });

  it("preserves higher-priority evidence policy when user asks for assumptions", () => {
    const result = new ConflictResolver().resolveWithConflicts(
      ["core_policy", "evidence_policy", "evidence_policy"],
      "Assume the missing details and fill in the blanks."
    );

    expect(result.policies).toEqual(["core_policy", "evidence_policy"]);
    expect(result.conflictDetected).toBe(true);
    expect(result.conflicts[0]?.higherPriorityRule).toBe("evidence_policy");
    expect(result.resolution).toContain("evidence_policy");
  });

  it("does not include memory policy unless memory exists", () => {
    const selector = new PolicySelector();
    const withoutMemory = selector.select({
      mode: "intake",
      risk: lowRisk,
      boundaryMode: "allow",
      userInput: "Extract this signal."
    });
    const withMemory = selector.select({
      mode: "intake",
      risk: lowRisk,
      boundaryMode: "allow",
      userInput: "Extract this signal.",
      retrievedMemory: [{ id: "mem-1" }]
    });

    expect(withoutMemory).not.toContain("memory_policy");
    expect(withMemory).toContain("memory_policy");
  });

  it("adds tool policy to planning only when project or tool context needs it", () => {
    const selector = new PolicySelector();
    const generic = selector.select({
      mode: "planning",
      risk: lowRisk,
      boundaryMode: "allow",
      userInput: "Plan my week."
    });
    const project = selector.select({
      mode: "planning",
      risk: lowRisk,
      boundaryMode: "allow",
      userInput: "Plan a repo implementation."
    });

    expect(generic).not.toContain("tool_policy");
    expect(project).toContain("tool_policy");
  });
});
