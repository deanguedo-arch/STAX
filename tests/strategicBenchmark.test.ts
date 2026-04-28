import { describe, expect, it } from "vitest";
import { StrategicBenchmark, scoreStrategicAnswer } from "../src/strategy/StrategicBenchmark.js";
import type { StrategicBenchmarkCollection } from "../src/strategy/StrategicBenchmarkSchemas.js";

const strongStax = [
  "## Strategic Question",
  "- What should STAX build next?",
  "## Capability Warning",
  "- Capability warning: provider capability is limited_mock.",
  "## Options Considered",
  "1. Strategic Deliberation - value high.",
  "2. More autonomy - value medium.",
  "3. Provider only - value medium.",
  "## Best Option",
  "- Strategic Deliberation",
  "## Why This Beats The Alternatives",
  "- It rejects more autonomy because automating weak strategy is risky.",
  "## Red-Team Failure Modes",
  "- Could become generic.",
  "- Could overfit benchmark wording.",
  "## Opportunity Cost",
  "- Delays automation.",
  "## Reversibility",
  "- reversible",
  "## Evidence Used",
  "- Local proof gates already exist.",
  "## Evidence Missing",
  "- External baseline strategy comparison.",
  "## Decision",
  "- Select Strategic Deliberation. Confidence: low.",
  "## Next Proof Step",
  "- Run `npm run rax -- strategy benchmark` and paste back the output.",
  "## Kill Criteria",
  "- If 3 of 10 outputs are generic, stop."
].join("\n");

const weakExternal = "STAX should improve broad reasoning by adding more strategy, memory, and agents. The next step is to make a roadmap and improve it over time.";

function variedStrongStax(index: number): string {
  return strongStax
    .replace(/Strategic Deliberation/g, `Strategic Deliberation ${index}`)
    .replace(/Run `npm run rax -- strategy benchmark` and paste back the output\./, `Run npm run rax -- strategy benchmark --file fixtures/strategy_benchmark/case_${index}.json and paste back the output.`);
}

describe("StrategicBenchmark", () => {
  it("scores strategic answers with kill criteria and option comparison higher than generic strategy", () => {
    expect(scoreStrategicAnswer(strongStax).total).toBeGreaterThan(scoreStrategicAnswer(weakExternal).total);
  });

  it("marks a small strategic slice as not broad superiority yet", () => {
    const collection: StrategicBenchmarkCollection = {
      id: "small-strategy-slice",
      externalCapturedAt: "2026-04-27T12:00:00.000Z",
      externalAnswerSource: "chatgpt-stax-browser",
      cases: [
        {
          id: "stax_next_direction",
          workLane: "product_strategy",
          task: "What should STAX build next?",
          context: "STAX needs a broad strategy decision.",
          staxAnswer: strongStax,
          externalAnswer: weakExternal,
          expectedWinner: "stax_better"
        }
      ]
    };

    const summary = new StrategicBenchmark().scoreCollection(collection);

    expect(summary.staxBetter).toBe(1);
    expect(summary.status).toBe("not_proven");
    expect(summary.gaps.join(" ")).toContain("Need at least 25");
  });

  it("rejects drifted external baselines for broad strategy tasks", () => {
    const driftedExternal = [
      "STAX is now legitimately useful as a local repo operator.",
      "The dogfood report shows command evidence improved in canvas-helper and brightspacequizexporter.",
      "The 50-case Local Problem Benchmark proves bounded local repo work is stronger.",
      "It is better at fake-complete detection and command evidence, but not broad strategy."
    ].join(" ");
    const collection: StrategicBenchmarkCollection = {
      id: "drifted-external",
      externalCapturedAt: "2026-04-27T12:00:00.000Z",
      externalAnswerSource: "chatgpt-stax-browser",
      cases: [
        {
          id: "broad_strategy_drift",
          workLane: "product_strategy",
          task: "Is STAX better than ChatGPT at broad strategic reasoning?",
          context: "The answer must evaluate Strategic Deliberation Mode and broad reasoning, not local repo proof.",
          staxAnswer: strongStax,
          externalAnswer: driftedExternal,
          expectedWinner: "no_external_baseline"
        }
      ]
    };

    const summary = new StrategicBenchmark().scoreCollection(collection);

    expect(summary.noExternalBaseline).toBe(1);
    expect(summary.results[0]?.externalBaselineIssues.join(" ")).toContain("drifted into local repo-operator");
  });

  it("can reach broad reasoning candidate only with enough clean strategy comparisons", () => {
    const lanes = ["product_strategy", "creative_planning", "ambiguous_judgment", "cross_domain", "teaching_strategy"];
    const collection: StrategicBenchmarkCollection = {
      id: "strategy-candidate",
      cases: Array.from({ length: 25 }, (_, index) => ({
        id: `case_${index}`,
        workLane: lanes[index % lanes.length] ?? "product_strategy",
        task: `Choose the best strategic direction for case ${index}.`,
        context: `Broad strategy context for case ${index}.`,
        staxAnswer: variedStrongStax(index),
        externalAnswer: weakExternal,
        externalCapturedAt: `2026-04-${String((index % 2) + 26).padStart(2, "0")}T12:00:00.000Z`,
        externalAnswerSource: "chatgpt-stax-browser",
        expectedWinner: "stax_better" as const
      }))
    };

    const summary = new StrategicBenchmark().scoreCollection(collection);

    expect(summary.status).toBe("broad_reasoning_candidate");
    expect(summary.gaps).toEqual([]);
  });

  it("treats the captured strategic holdouts as a broad reasoning candidate", async () => {
    const summary = await new StrategicBenchmark(process.cwd()).scoreDirectory("fixtures/strategy_benchmark");

    expect(summary.total).toBe(99);
    expect(summary.staxBetter).toBe(99);
    expect(summary.externalBetter).toBe(0);
    expect(summary.ties).toBe(0);
    expect(summary.noExternalBaseline).toBe(0);
    expect(summary.templateCollapseCases).toBe(0);
    expect(summary.workLanes).toBe(5);
    expect(summary.captureDates).toBe(2);
    expect(summary.status).toBe("broad_reasoning_candidate");
    expect(summary.gaps).toEqual([]);
  });

  it("keeps the post-repair blind holdout from collapsing into one strategy template", async () => {
    const summary = await new StrategicBenchmark(process.cwd()).scoreFile("fixtures/strategy_benchmark/strategic_deliberation_v3_blind_postrepair_2026-04-28.json");

    expect(summary.total).toBe(25);
    expect(summary.staxBetter).toBe(25);
    expect(summary.externalBetter).toBe(0);
    expect(summary.ties).toBe(0);
    expect(summary.noExternalBaseline).toBe(0);
    expect(summary.templateCollapseCases).toBe(0);
    expect(summary.workLanes).toBe(5);
    expect(summary.status).toBe("not_proven");
    expect(summary.gaps).toEqual(["Need external captures on at least 2 dates; current 1."]);
  });

  it("rejects repeated STAX strategy templates across a broad benchmark", () => {
    const lanes = ["product_strategy", "creative_planning", "ambiguous_judgment", "cross_domain", "teaching_strategy"];
    const collection: StrategicBenchmarkCollection = {
      id: "template-collapse",
      cases: Array.from({ length: 25 }, (_, index) => ({
        id: `collapse_${index}`,
        workLane: lanes[index % lanes.length] ?? "product_strategy",
        task: `Choose the best strategic direction for case ${index}.`,
        context: `Broad strategy context for case ${index}.`,
        staxAnswer: strongStax,
        externalAnswer: weakExternal,
        externalCapturedAt: `2026-04-${String((index % 2) + 26).padStart(2, "0")}T12:00:00.000Z`,
        externalAnswerSource: "chatgpt-stax-browser"
      }))
    };

    const summary = new StrategicBenchmark().scoreCollection(collection);

    expect(summary.status).toBe("not_proven");
    expect(summary.templateCollapseCases).toBe(25);
    expect(summary.gaps.join(" ")).toContain("repeated STAX strategy templates");
  });
});
