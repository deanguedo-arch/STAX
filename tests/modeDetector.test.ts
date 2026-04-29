import { describe, expect, it } from "vitest";
import { ModeDetector } from "../src/classifiers/ModeDetector.js";

describe("ModeDetector", () => {
  it("detects planning mode with confidence and matched terms", () => {
    const result = new ModeDetector().detect("Build a project architecture plan.");

    expect(result.mode).toBe("planning");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.matchedTerms).toContain("build");
    expect(result.fallbackUsed).toBe(false);
  });

  it("falls back to analysis when confidence is low", () => {
    const result = new ModeDetector().detect("hello there");

    expect(result.mode).toBe("analysis");
    expect(result.fallbackUsed).toBe(true);
  });

  it("detects STAX fitness terms", () => {
    const result = new ModeDetector().detect("STAX fitness sleep recovery signal");

    expect(result.mode).toBe("stax_fitness");
    expect(result.matchedTerms).toEqual(
      expect.arrayContaining(["fitness", "sleep"])
    );
  });

  it("does not treat STAX system prompts as fitness", () => {
    const system = new ModeDetector().detect("STAX system improvement");
    const learning = new ModeDetector().detect("STAX approved learning loop");
    const policy = new ModeDetector().detect("STAX policy drift");

    expect(system.mode).not.toBe("stax_fitness");
    expect(learning.mode).toBe("learning_unit");
    expect(policy.mode).toBe("policy_drift");
  });

  it("keeps explicit domain fitness routing", () => {
    const result = new ModeDetector().detect("STAX BJJ sleep recovery");

    expect(result.mode).toBe("stax_fitness");
    expect(result.matchedTerms).toEqual(expect.arrayContaining(["bjj", "recovery"]));
  });

  it("detects external answer comparison mode", () => {
    const result = new ModeDetector().detect("Compare the STAX answer with this ChatGPT answer.");

    expect(result.mode).toBe("model_comparison");
  });

  it("detects neutral project-control benchmark prompts", () => {
    const result = new ModeDetector().detect([
      "You are being tested on a project-control task.",
      "Task: Audit this Codex report.",
      "Repo Evidence: no local evidence supplied.",
      "Command Evidence: none.",
      "Codex Report: Codex says tests passed.",
      "Return:",
      "1. Verdict",
      "6. One Next Action"
    ].join("\n"));

    expect(result.mode).toBe("project_control");
  });

  it("detects strategic deliberation mode for broad reasoning", () => {
    const result = new ModeDetector().detect("What is the best next direction for STAX broad reasoning?");

    expect(result.mode).toBe("strategic_deliberation");
  });
});
