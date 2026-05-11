import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import {
  evaluateStaxTrialLeague,
  expandStaxTrialCases,
  loadStaxTrialLeague
} from "../src/sidecar/StaxTrialLeague.js";

const REQUIRED_PHASE_1_CATEGORIES = [
  "fake_complete",
  "stale_evidence",
  "forged_evidence",
  "wrong_repo",
  "wrong_branch",
  "ignored_relevant_file",
  "visual_claim_no_visual_proof",
  "release_claim_no_release_proof",
  "human_review_missing_approval",
  "vague_claim_evasion"
];

describe("STAX Phase 1 adversarial trial league", () => {
  it("loads a 50-case fixture league with every required adversarial category", async () => {
    const league = await loadStaxTrialLeague();
    const cases = expandStaxTrialCases(league);
    const categories = new Set<string>(cases.map((testCase) => testCase.category));

    expect(cases).toHaveLength(50);
    for (const category of REQUIRED_PHASE_1_CATEGORIES) {
      expect(categories.has(category), category).toBe(true);
    }
  });

  it("meets Phase 1 no-false-accept and false-reject thresholds", async () => {
    const league = await loadStaxTrialLeague();
    const result = evaluateStaxTrialLeague(league);

    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.criticalFalseAccepts).toBe(0);
    expect(result.falseRejectRate).toBeLessThanOrEqual(league.thresholds.maxFalseRejectRate);
    expect(result.nextPromptActionableRate).toBeGreaterThanOrEqual(league.thresholds.minNextPromptActionableRate);
  });

  it("classifies vague completion wording as proof-bearing claims", async () => {
    const league = await loadStaxTrialLeague();
    const result = evaluateStaxTrialLeague(league);
    const vagueCases = result.evaluations.filter((testCase) => testCase.category === "vague_claim_evasion");

    expect(vagueCases.length).toBeGreaterThan(0);
    for (const testCase of vagueCases) {
      expect(testCase.actualVerdict).toBe("reject");
      expect(testCase.detectedClaims.map((claim) => claim.claimType)).toEqual(
        expect.arrayContaining(["implementation", "test", "behavior"])
      );
      expect(testCase.missingProof).toEqual(
        expect.arrayContaining(["source_diff", "behavior_test", "command_evidence_after_diff"])
      );
    }
  });

  it("keeps supported controls accepted so false-reject metrics are meaningful", async () => {
    const league = await loadStaxTrialLeague();
    const result = evaluateStaxTrialLeague(league);
    const supportedControls = result.evaluations.filter((testCase) => testCase.shouldAccept);

    expect(supportedControls).toHaveLength(10);
    expect(supportedControls.map((testCase) => testCase.actualVerdict)).toEqual(
      Array.from({ length: supportedControls.length }, () => "accept")
    );
  });

  it("keeps the published results artifact aligned with the evaluated league summary", async () => {
    const league = await loadStaxTrialLeague();
    const result = evaluateStaxTrialLeague(league);
    const published = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "fixtures", "stax_trials", "results.json"), "utf8")
    ) as {
      expandedCases: number;
      criticalFalseAccepts: number;
      falseRejects: number;
      falseRejectRate: number;
      nextPromptActionableRate: number;
      passed: boolean;
    };

    expect(published).toMatchObject({
      expandedCases: result.expandedCases,
      criticalFalseAccepts: result.criticalFalseAccepts,
      falseRejects: result.falseRejects,
      falseRejectRate: result.falseRejectRate,
      nextPromptActionableRate: result.nextPromptActionableRate,
      passed: result.passed
    });
  });
});
