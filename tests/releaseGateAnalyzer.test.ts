import { describe, expect, it } from "vitest";
import { analyzeReleaseGate, loadReleaseGateFixtureCases } from "../src/evidence/ReleaseGateAnalyzer.js";

describe("release gate analyzer", () => {
  it("keeps the 50-case release-gate fixture gate live", async () => {
    const cases = await loadReleaseGateFixtureCases();
    expect(cases).toHaveLength(50);
  });

  it("classifies release proof findings across the fixture suite", async () => {
    const cases = await loadReleaseGateFixtureCases();
    for (const testCase of cases) {
      const result = analyzeReleaseGate(testCase);
      expect(result.verdict, testCase.caseId).toBe(testCase.expectedVerdict);
      for (const findingId of testCase.expectedFindingIds) {
        expect(result.findings.map((finding) => finding.id), testCase.caseId).toContain(findingId);
      }
    }
  });

  it("keeps false accepts at zero for weak release proof", async () => {
    const cases = await loadReleaseGateFixtureCases();
    for (const testCase of cases.filter((item) => !item.shouldCountAsStrong)) {
      const result = analyzeReleaseGate(testCase);
      expect(result.verdict, testCase.caseId).not.toBe("accept");
    }
  });

  it("accepts build plus target plus rollback plus staging plus signing proof", () => {
    const result = analyzeReleaseGate({
      task: "Audit whether this deploy claim is proven.",
      description: "Release build passed, target validated, rollback tested, staging smoke passed, signing ready.",
      source: "build_log",
      buildPassed: true,
      targetEnvironment: "production",
      targetValidated: true,
      rollbackPlan: "Revert to prior deployment artifact.",
      rollbackValidated: true,
      stagingValidated: true,
      authSigningReady: true
    });

    expect(result.verdict).toBe("accept");
    expect(result.supportsReleaseClaim).toBe(true);
  });
});
