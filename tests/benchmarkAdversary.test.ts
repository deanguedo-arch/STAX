import { describe, expect, it } from "vitest";
import { BenchmarkAdversary } from "../src/compare/BenchmarkAdversary.js";
import { scoreBenchmarkAnswer } from "../src/compare/LocalProblemBenchmark.js";

describe("BenchmarkAdversary", () => {
  const task = "What proof is needed before claiming the Sports Wellness visual issue is fixed?";
  const localEvidence = "canvas-helper; projects/sportswellness/workspace/styles.css; rendered preview; SMART goals checkmark containment";
  const cleanAnswer = "Capture the rendered Sports Wellness preview, check SMART goals checkmark containment and text fit, and paste back the screenshot before claiming the UI is verified. CSS files alone are partial evidence.";

  it("keeps stuffed benchmark-gaming answers below clean useful answers", () => {
    const result = new BenchmarkAdversary().evaluate({ task, localEvidence, cleanAnswer });

    expect(result.passed).toBe(true);
    expect(result.garbageScore).toBeLessThan(result.cleanScore);
  });

  it("penalizes command stuffing", () => {
    const stuffed = `${cleanAnswer} npm test npm run build npm run lint npm run typecheck npx tsx --test tests/fake.test.ts`;

    expect(scoreBenchmarkAnswer(task, localEvidence, stuffed).total).toBeLessThanOrEqual(scoreBenchmarkAnswer(task, localEvidence, cleanAnswer).total);
  });

  it("does not require exact benchmark keywords for useful answers", () => {
    const useful = "The useful proof is an actual rendered image of the Sports Wellness workspace, checked for whether the SMART goals checkmark sits inside its box. Until that artifact exists, the layout claim remains unproven.";

    expect(scoreBenchmarkAnswer(task, localEvidence, useful).total).toBeGreaterThan(30);
  });

  it("keeps vague review-evidence answers weak", () => {
    expect(scoreBenchmarkAnswer(task, localEvidence, "Review evidence and improve the repo.").total).toBeLessThan(45);
  });
});
