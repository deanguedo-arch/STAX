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
      externalAnswer: "Review the repo, run tests, and fix the dependency issue.",
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
      requiredQualities: []
    });

    expect(result.winner).toBe("no_local_basis");
    expect(result.missingLocalEvidence).not.toHaveLength(0);
  });

  it("passes the real 15-task fixture slice with no external-better cases", async () => {
    const summary = await new LocalProblemBenchmark(process.cwd()).scoreFile("fixtures/problem_benchmark/real_repo_15_tasks.json");

    expect(summary.total).toBe(15);
    expect(summary.externalBetter).toBe(0);
    expect(summary.noLocalBasis).toBe(0);
    expect(summary.stopConditionMet).toBe(true);
    expect(summary.confidence).toBe("benchmark_slice_proven");
  });
});
