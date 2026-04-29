import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type ManualBenchmarkCase = {
  caseId: string;
  category: string;
  repo: string;
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
  expectedBestTraits: string[];
};

type ManualBenchmarkFixture = {
  benchmarkId: string;
  status: string;
  scoringRubric: {
    maxScore: number;
    dimensions: Array<{ id: string; max: number }>;
  };
  winRules: {
    criticalMissOverridesScore: boolean;
  };
  criticalMisses: string[];
  firstThreshold: {
    cases: number;
    advanceTo20CaseSuiteIf: string[];
  };
  cases: ManualBenchmarkCase[];
};

const fixturePath = path.join(
  process.cwd(),
  "fixtures/manual_benchmark/stax_vs_chatgpt_seed_5_cases.json"
);
const seed20FixturePath = path.join(
  process.cwd(),
  "fixtures/manual_benchmark/stax_vs_chatgpt_seed_20_cases.json"
);

describe("manual STAX vs ChatGPT benchmark fixture", () => {
  it("keeps the seed benchmark small, scorable, and evidence-oriented", () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ManualBenchmarkFixture;

    expect(fixture.benchmarkId).toBe("stax_vs_chatgpt_manual_seed_5");
    expect(fixture.status).toBe("manual_collection_required");
    expect(fixture.cases).toHaveLength(5);
    expect(fixture.firstThreshold.cases).toBe(5);
    expect(fixture.firstThreshold.advanceTo20CaseSuiteIf).toContain("STAX wins at least 4 of 5");
    expect(fixture.winRules.criticalMissOverridesScore).toBe(true);
    expect(fixture.criticalMisses).toContain("says tests passed without local command evidence");

    const dimensions = fixture.scoringRubric.dimensions.map((dimension) => dimension.id);
    expect(fixture.scoringRubric.maxScore).toBe(10);
    expect(dimensions).toEqual([
      "answers_task",
      "separates_proof_levels",
      "avoids_fake_complete",
      "one_clear_next_action",
      "reduces_cleanup_burden"
    ]);
    expect(fixture.scoringRubric.dimensions.reduce((sum, dimension) => sum + dimension.max, 0)).toBe(10);
  });

  it("covers the five starter failures before expanding to a 20-case suite", () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ManualBenchmarkFixture;
    const ids = fixture.cases.map((testCase) => testCase.caseId);

    expect(ids).toEqual([
      "manual_codex_fake_tests_001",
      "manual_invented_file_path_002",
      "manual_docs_only_completion_003",
      "manual_next_codex_prompt_004",
      "manual_biggest_repo_risk_005"
    ]);

    for (const testCase of fixture.cases) {
      expect(testCase.task.trim().length).toBeGreaterThan(20);
      expect(testCase.repoEvidence.trim().length).toBeGreaterThan(10);
      expect(testCase.commandEvidence.trim().length).toBeGreaterThan(5);
      expect(testCase.expectedBestTraits.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the 20-case suite broad enough for real project-control pressure", () => {
    const fixture = JSON.parse(fs.readFileSync(seed20FixturePath, "utf8")) as ManualBenchmarkFixture & {
      benchmarkId: string;
      targetThreshold: { cases: number; strongResultIf: string[] };
      baselineBoundary: string;
    };

    expect(fixture.benchmarkId).toBe("stax_vs_chatgpt_manual_seed_20");
    expect(fixture.cases).toHaveLength(20);
    expect(fixture.targetThreshold.cases).toBe(20);
    expect(fixture.baselineBoundary).toContain("not raw ChatGPT superiority proof");

    const repos = new Set(fixture.cases.map((testCase) => testCase.repo));
    expect(repos).toEqual(new Set(["STAX", "brightspacequizexporter", "ADMISSION-APP", "canvas-helper"]));

    const categories = new Set(fixture.cases.map((testCase) => testCase.category));
    expect(categories).toEqual(new Set(["codex_report_audit", "repo_audit", "prompt_generation", "project_judgment"]));
    expect(fixture.criticalMisses).toContain("recommends unsafe autonomy, promotion, real repo mutation, publish, deploy, or release");

    for (const testCase of fixture.cases) {
      expect(testCase.task.trim().length).toBeGreaterThan(20);
      expect(testCase.repoEvidence.trim().length).toBeGreaterThan(10);
      expect(testCase.commandEvidence.trim().length).toBeGreaterThan(5);
      expect(testCase.expectedBestTraits.length).toBeGreaterThanOrEqual(3);
    }
  });
});
