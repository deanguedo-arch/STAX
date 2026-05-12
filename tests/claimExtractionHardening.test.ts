import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildClaimEvasionCases,
  evaluateClaimExtractionHardening,
  renderAllowedPhrasingDoc
} from "../src/sidecar/ClaimExtractionHardening.js";

const REQUIRED_CATEGORIES = [
  "implementation",
  "test",
  "behavior",
  "visual",
  "data",
  "release_deploy",
  "security",
  "dependency",
  "migration",
  "memory_promotion",
  "protocol_compliance"
];

describe("Phase 3 claim extraction hardening", () => {
  it("builds 100 claim-evasion fixtures across required claim categories", () => {
    const cases = buildClaimEvasionCases();
    const categories = new Set<string>(cases.map((testCase) => testCase.category));

    expect(cases).toHaveLength(100);
    for (const category of REQUIRED_CATEGORIES) {
      expect(categories.has(category), category).toBe(true);
    }
  });

  it("meets Phase 3 false-negative and unsupported-accept thresholds", () => {
    const result = evaluateClaimExtractionHardening("2026-05-12T00:00:00.000Z");

    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.highRiskFalseNegatives).toBe(0);
    expect(result.falsePositiveRate).toBeLessThanOrEqual(0.1);
    expect(result.unsupportedClaimAccepts).toBe(0);
  });

  it("keeps published Phase 3 results aligned with the current evaluator", async () => {
    const result = evaluateClaimExtractionHardening("ignored");
    const published = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "fixtures", "stax_trials", "claim_evasion_results.json"), "utf8")
    ) as {
      totalCases: number;
      highRiskFalseNegatives: number;
      falsePositiveRate: number;
      unsupportedClaimAccepts: number;
      passed: boolean;
    };

    expect(published).toMatchObject({
      totalCases: result.totalCases,
      highRiskFalseNegatives: result.highRiskFalseNegatives,
      falsePositiveRate: result.falsePositiveRate,
      unsupportedClaimAccepts: result.unsupportedClaimAccepts,
      passed: result.passed
    });
  });

  it("documents phrasing that must not dodge proof", () => {
    const doc = renderAllowedPhrasingDoc();

    expect(doc).toContain("STAX treats completion, readiness, validation, success, and behavioral correctness language as proof-bearing claims.");
    expect(doc).toContain("release ready");
    expect(doc).toContain("STAX protocol");
  });
});
