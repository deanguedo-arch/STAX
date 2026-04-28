import { describe, expect, it } from "vitest";
import { LocalProblemBenchmark } from "../src/compare/LocalProblemBenchmark.js";

describe("LocalProblemBenchmark", () => {
  it("marks evidence-backed STAX answers better than generic external answers", () => {
    const benchmark = new LocalProblemBenchmark();
    const result = benchmark.scoreCase({
      id: "stax-wins",
      repo: "brightspacequizexporter",
      task: "What is the biggest current operating risk in brightspacequizexporter?",
      localEvidence: "repo-script:ingest:ci; command-evidence npm run ingest:ci failed; @rollup/rollup-darwin-arm64 missing",
      staxAnswer: "Stored command evidence says `npm run ingest:ci` failed because @rollup/rollup-darwin-arm64 is missing. Treat this as partial proof only; no source mutation happened. One next step: Run `npm ls @rollup/rollup-darwin-arm64 rollup vite` and paste back the full output.",
      externalAnswer: "The biggest risk is the blocked ingest gate. Inspect the Rollup optional dependency issue before trusting the build or ingest process.",
      externalAnswerSource: "chatgpt-stax",
      externalCapturedAt: "2026-04-27T00:00:00.000Z",
      externalPrompt: "Answer the brightspacequizexporter operating-risk task using local repo evidence.",
      requiredQualities: []
    });

    expect(result.winner).toBe("stax_better");
    expect(result.staxScore.total).toBeGreaterThan(result.externalScore.total);
  });

  it("detects when the external answer is more actionable", () => {
    const benchmark = new LocalProblemBenchmark();
    const result = benchmark.scoreCase({
      id: "external-wins",
      repo: "canvas-helper",
      task: "What proof is needed for the Sports Wellness visual issue?",
      localEvidence: "sportswellness; projects/sportswellness/workspace/styles.css; SMART goals checkmark containment; rendered preview",
      staxAnswer: "Review the evidence and improve the repo.",
      externalAnswer: "Capture the rendered Sports Wellness preview for SMART goals checkmark containment and text fit; paste back a screenshot before claiming the fix is verified.",
      externalAnswerSource: "chatgpt-stax",
      externalCapturedAt: "2026-04-27T00:00:00.000Z",
      externalPrompt: "Answer the canvas-helper Sports Wellness proof task using local repo evidence.",
      requiredQualities: []
    });

    expect(result.winner).toBe("external_better");
    expect(result.correctionCandidate).toContain("Candidate correction");
  });

  it("refuses to declare a winner without local evidence", () => {
    const benchmark = new LocalProblemBenchmark();
    const result = benchmark.scoreCase({
      id: "no-evidence",
      repo: "app-admissions",
      task: "What is the biggest risk?",
      localEvidence: "",
      staxAnswer: "Run `npm run build:pages` and paste back output.",
      externalAnswer: "Sync origin first.",
      externalAnswerSource: "chatgpt-stax",
      externalCapturedAt: "2026-04-27T00:00:00.000Z",
      externalPrompt: "Answer the app-admissions risk task using local repo evidence.",
      requiredQualities: []
    });

    expect(result.winner).toBe("no_local_basis");
    expect(result.missingLocalEvidence).not.toHaveLength(0);
  });

  it("refuses to declare a winner without a captured external baseline", () => {
    const benchmark = new LocalProblemBenchmark();
    const result = benchmark.scoreCase({
      id: "no-external-baseline",
      repo: "canvas-helper",
      task: "What proof is needed for Sports Wellness?",
      localEvidence: "repo-script:test:e2e; sportswellness; projects/sportswellness/workspace/styles.css; rendered preview",
      staxAnswer: "One next step: capture the rendered Sports Wellness preview and paste back whether the SMART goals checkmark fits.",
      externalAnswer: "Review the repo and fix the issue.",
      requiredQualities: []
    });

    expect(result.winner).toBe("no_external_baseline");
    expect(result.externalBaselineGaps).not.toHaveLength(0);
  });

  it("passes the real 15-task fixture slice with no external-better cases", async () => {
    const summary = await new LocalProblemBenchmark(process.cwd()).scoreFile("fixtures/problem_benchmark/real_repo_15_tasks.json");

    expect(summary.total).toBe(15);
    expect(summary.externalBetter).toBe(0);
    expect(summary.noLocalBasis).toBe(0);
    expect(summary.noExternalBaseline).toBe(0);
    expect(summary.stopConditionMet).toBe(true);
    expect(summary.confidence).toBe("benchmark_slice_proven");
    expect(summary.superiorityStatus).toBe("slice_only");
    expect(summary.continueLoopRequired).toBe(true);
    expect(summary.superiorityGaps.join(" ")).toContain("Need at least 50 captured comparisons");
  });

  it("passes the real 50-task benchmark but keeps the loop open until multi-date baselines exist", async () => {
    const summary = await new LocalProblemBenchmark(process.cwd()).scoreFile("fixtures/problem_benchmark/real_repo_50_tasks.json");

    expect(summary.total).toBe(50);
    expect(summary.staxBetter).toBe(50);
    expect(summary.externalBetter).toBe(0);
    expect(summary.ties).toBe(0);
    expect(summary.noLocalBasis).toBe(0);
    expect(summary.noExternalBaseline).toBe(0);
    expect(summary.stopConditionMet).toBe(true);
    expect(summary.confidence).toBe("benchmark_slice_proven");
    expect(summary.superiorityStatus).toBe("slice_only");
    expect(summary.continueLoopRequired).toBe(true);
    expect(summary.superiorityGaps).toEqual(["Need external baselines captured on at least 2 dates; current 1."]);
  });

  it("passes the corrected fresh holdout after applying tie corrections", async () => {
    const summary = await new LocalProblemBenchmark(process.cwd()).scoreFile("fixtures/problem_benchmark/fresh_holdout_25_tasks.json");

    expect(summary.total).toBe(25);
    expect(summary.staxBetter).toBe(25);
    expect(summary.externalBetter).toBe(0);
    expect(summary.ties).toBe(0);
    expect(summary.noLocalBasis).toBe(0);
    expect(summary.noExternalBaseline).toBe(0);
    expect(summary.expectedMismatches).toBe(0);
    expect(summary.holdoutFreshnessGaps).toEqual([]);
    expect(summary.stopConditionMet).toBe(true);
    expect(summary.confidence).toBe("benchmark_slice_proven");
    expect(summary.superiorityStatus).toBe("slice_only");
    expect(summary.continueLoopRequired).toBe(true);
    expect(summary.superiorityGaps).toContain("Need at least 50 captured comparisons for a superiority candidate; current 25.");
    expect(summary.superiorityGaps).toContain("Need external baselines captured on at least 2 dates; current 1.");
  });

  it("blocks required holdout freshness when a new task repeats the same repo, family, and proof boundary", () => {
    const benchmark = new LocalProblemBenchmark();
    const prior = {
      id: "prior_visual",
      repo: "canvas-helper",
      task: "What proof is missing for the Sports Wellness rendered layout?",
      proofBoundary: "rendered_visual_artifact",
      taskFamily: "visual_evidence",
      localEvidence: "workspace canvas-helper; projects/sportswellness/workspace/styles.css; rendered preview required",
      staxAnswer: "Capture a rendered preview and paste back the finding.",
      externalAnswer: "Capture a screenshot.",
      externalAnswerSource: "chatgpt-thread-a",
      externalCapturedAt: "2026-04-27T00:00:00.000Z",
      externalPrompt: "Answer using local evidence.",
      requiredQualities: []
    };
    const result = benchmark.scoreCase({
      id: "repeat_visual",
      repo: "canvas-helper",
      task: "What visual evidence is absent for the Sports Wellness layout?",
      proofBoundary: "rendered_visual_artifact",
      taskFamily: "visual_evidence",
      localEvidence: "workspace canvas-helper; projects/sportswellness/workspace/styles.css; rendered preview required",
      staxAnswer: "Capture the rendered Sports Wellness preview and paste back text fit.",
      externalAnswer: "Capture a screenshot.",
      externalAnswerSource: "chatgpt-thread-b",
      externalCapturedAt: "2026-04-28T00:00:00.000Z",
      externalPrompt: "Answer using local evidence.",
      requiredQualities: []
    }, { priorCases: [prior], requireHoldoutFreshness: true });

    expect(result.holdoutFreshness?.isFresh).toBe(false);
    expect(result.holdoutFreshness?.blockingReasons.join(" ")).toContain("Same repo, task family, and proof boundary");
  });

  it("preserves collection-level baseline metadata when scoring a benchmark directory", async () => {
    const summary = await new LocalProblemBenchmark(process.cwd()).scoreDirectory("fixtures/problem_benchmark");

    expect(summary.total).toBe(250);
    expect(summary.noExternalBaseline).toBe(0);
    expect(summary.externalBetter).toBe(0);
    expect(summary.ties).toBe(0);
    expect(summary.stopConditionMet).toBe(true);
    expect(summary.superiorityStatus).toBe("slice_only");
    expect(summary.proofIntegrityGaps.join(" ")).toContain("Post-correction evidence cannot support a superiority candidate");
    expect(summary.superiorityGaps).toEqual(summary.proofIntegrityGaps);
  });
});
