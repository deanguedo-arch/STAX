import { describe, expect, it } from "vitest";
import { ModeDetector } from "../src/classifiers/ModeDetector.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { StrategicDecisionGate } from "../src/strategy/StrategicDecisionGate.js";
import { validateModeOutput } from "../src/utils/validators.js";

const validStrategicOutput = [
  "## Strategic Question",
  "- How should STAX become better than ChatGPT at broad reasoning?",
  "",
  "## Capability Warning",
  "- Capability warning: provider capability is limited_mock. Treat this as draft strategy only and compare against a strong external answer before acting.",
  "",
  "## Options Considered",
  "1. Build Strategic Deliberation Mode v0 (strategic_deliberation_v0) - value=high; cost=medium; reversibility=reversible. Compare options and select one.",
  "2. Build Strategic Benchmark v0 First (strategic_benchmark_first) - value=medium; cost=medium; reversibility=reversible. Measure before adding a new mode.",
  "",
  "## Best Option",
  "- Build Strategic Deliberation Mode v0",
  "",
  "## Why This Beats The Alternatives",
  "- It targets broad strategic reasoning quality.",
  "- Rejected strategic_benchmark_first: Benchmarking first measures the gap but does not improve strategic output.",
  "",
  "## Red-Team Failure Modes",
  "- Outputs headings without real tradeoffs.",
  "",
  "## Opportunity Cost",
  "- Delays broader autonomy work.",
  "",
  "## Reversibility",
  "- reversible",
  "",
  "## Evidence Used",
  "- The user explicitly wants broad reasoning, not only repo-proof reliability.",
  "",
  "## Evidence Missing",
  "- Strong reasoning-provider output or external strong-model comparison.",
  "",
  "## Decision",
  "- Select Build Strategic Deliberation Mode v0. Confidence: low.",
  "",
  "## Next Proof Step",
  "- Run `npm run rax -- run --mode strategic_deliberation \"How should STAX become better than ChatGPT at broad reasoning?\"` and compare the output against an external ChatGPT baseline.",
  "",
  "## Kill Criteria",
  "- If strategic outputs consider fewer than three options, fail to reject alternatives, or omit kill criteria in 3 of 10 benchmark tasks, do not expand the mode."
].join("\n");

describe("Strategic Deliberation Mode", () => {
  it("detects broad strategy prompts", () => {
    const result = new ModeDetector().detect("What is the best next direction for STAX broad reasoning?");

    expect(result.mode).toBe("strategic_deliberation");
    expect(result.matchedTerms).toContain("best next direction");
  });

  it("accepts a strategic decision with options, rejection, proof, and kill criteria", () => {
    const result = validateModeOutput("strategic_deliberation", validStrategicOutput);

    expect(result.valid).toBe(true);
  });

  it("rejects one-option strategy theater", () => {
    const output = validStrategicOutput.replace(
      /1\. Build Strategic[\s\S]*?## Best Option/,
      "1. Build Strategic Deliberation Mode v0 - value=high; cost=medium; reversibility=reversible.\n\n## Best Option"
    );
    const result = new StrategicDecisionGate().validate(output);

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("at least two options");
  });

  it("rejects strategy without kill criteria", () => {
    const output = validStrategicOutput.replace("## Kill Criteria\n- If strategic outputs consider fewer than three options, fail to reject alternatives, or omit kill criteria in 3 of 10 benchmark tasks, do not expand the mode.", "## Kill Criteria\n");
    const result = new StrategicDecisionGate().validate(output);

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("kill criteria");
  });

  it("rejects high confidence when evidence is missing", () => {
    const output = validStrategicOutput.replace("Confidence: low", "Confidence: high");
    const result = new StrategicDecisionGate().validate(output);

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("high confidence");
  });

  it("runtime produces a valid limited-provider strategic decision", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "How should STAX become better than ChatGPT at broad reasoning?",
      [],
      { mode: "strategic_deliberation" }
    );

    expect(output.taskMode).toBe("strategic_deliberation");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("## Capability Warning");
    expect(output.output).toContain("limited_mock");
    expect(output.output).toContain("## Kill Criteria");
  });
});
