import { describe, expect, it } from "vitest";
import { GeneralSuperiorityGate } from "../src/superiority/GeneralSuperiorityGate.js";
import type { ProblemBenchmarkCollection } from "../src/compare/ProblemBenchmarkSchemas.js";

const workLanes = [
  "local_repo",
  "strategy",
  "creative_ideation",
  "teaching_course_design",
  "research_synthesis",
  "writing_editing",
  "planning_prioritization",
  "code_implementation",
  "personal_memory",
  "tool_document_work",
  "self_improvement",
  "messy_judgment"
];

describe("GeneralSuperiorityGate", () => {
  it("does not treat current benchmark fixtures as general superiority", async () => {
    const report = await new GeneralSuperiorityGate(process.cwd()).evaluateDirectory("fixtures/problem_benchmark");

    expect(report.status).toBe("campaign_slice");
    expect(report.metrics.comparisons).toBe(250);
    expect(report.metrics.ties).toBe(0);
    expect(report.metrics.blindComparisons).toBe(160);
    expect(report.metrics.workLanes).toBeGreaterThanOrEqual(12);
    expect(report.metrics.captureDates).toBe(2);
    expect(report.gaps.join(" ")).toContain("Need at least 250 locked-before-external blind comparisons");
    expect(report.gaps.join(" ")).toContain("Need external baselines captured on at least 3 dates");
  });

  it("requires broad blind coverage before a general superiority candidate", () => {
    const collection: ProblemBenchmarkCollection = {
      id: "synthetic-general-superiority-pass",
      cases: Array.from({ length: 250 }, (_, index) => {
        const lane = workLanes[index % workLanes.length] ?? "local_repo";
        const family = `family_${index % 12}`;
        const repo = `domain_${index % 7}`;
        const source = index % 2 === 0 ? "chatgpt-stax-browser" : "chatgpt-default-browser";
        const day = String((index % 3) + 1).padStart(2, "0");
        return {
          id: `${lane}_${family}_${index}`,
          repo,
          workLane: lane,
          taskFamily: family,
          blind: true,
          task: `For ${repo}, solve ${lane} ${family} without overclaiming proof.`,
          localEvidence: `workspace ${repo}; package.json; repo-script:proof; src/${family}.ts; command-evidence proof not run; README evidence for ${lane}.`,
          staxAnswer: `For ${repo}/${family}, the answer is to use the supplied ${lane} evidence and keep proof status partial because the proof command has not run. This names package.json, src/${family}.ts, and the repo-script proof boundary. No source mutation, approval, promotion, or training export is justified from this evidence. One next step: Run \`npm run proof\` and paste back the full output and exit code.`,
          staxAnswerSource: "locked-stax-campaign",
          staxCapturedAt: "2026-04-27T10:00:00.000Z",
          externalAnswer: `For ${repo}/${family}, use the supplied evidence and do not claim completion. Check the relevant proof before making the final decision.`,
          externalAnswerSource: source,
          externalCapturedAt: `2026-04-${day}T12:00:00.000Z`,
          externalPrompt: "Answer the broad general-work task using only supplied evidence.",
          expectedWinner: "stax_better" as const,
          requiredQualities: [lane, family, "proof honesty"]
        };
      })
    };

    const report = new GeneralSuperiorityGate(process.cwd()).evaluateCollection(collection);

    expect(report.status).toBe("superiority_candidate");
    expect(report.metrics.comparisons).toBe(250);
    expect(report.metrics.blindComparisons).toBe(250);
    expect(report.metrics.workLanes).toBe(12);
    expect(report.metrics.taskFamilies).toBe(12);
    expect(report.metrics.reposOrDomains).toBe(7);
    expect(report.metrics.externalSources).toBe(2);
    expect(report.metrics.captureDates).toBe(3);
    expect(report.gaps).toEqual([]);
  });
});
