import { describe, expect, it } from "vitest";
import { analyzeTestQuality, loadTestQualityFixtureCases } from "../src/evidence/TestQualityAnalyzer.js";

describe("test quality analyzer", () => {
  it("keeps the 100-case test-quality fixture gate live", async () => {
    const cases = await loadTestQualityFixtureCases();
    expect(cases).toHaveLength(100);
  });

  it("classifies test-quality findings across the fixture suite", async () => {
    const cases = await loadTestQualityFixtureCases();
    for (const testCase of cases) {
      const result = analyzeTestQuality(testCase);
      expect(result.verdict, testCase.caseId).toBe(testCase.expectedVerdict);
      for (const findingId of testCase.expectedFindingIds) {
        expect(result.findings.map((finding) => finding.id), testCase.caseId).toContain(findingId);
      }
    }
  });

  it("keeps false accepts at zero for weak test diffs", async () => {
    const cases = await loadTestQualityFixtureCases();
    const weakCases = cases.filter((testCase) => !testCase.shouldCountAsStrong);
    for (const testCase of weakCases) {
      const result = analyzeTestQuality(testCase);
      expect(result.verdict, testCase.caseId).not.toBe("accept");
    }
  });

  it("accepts meaningful behavior assertions with integration evidence", () => {
    const result = analyzeTestQuality({
      filePath: "tests/ui-layout.test.ts",
      intendedClaim: "behavior",
      patch: [
        "@@",
        "+it('renders the warning state', async () => {",
        "+  render(<Banner state=\"warning\" />);",
        "+  expect(screen.getByText('Warning')).toBeVisible();",
        "+});"
      ].join("\n")
    });

    expect(result.verdict).toBe("accept");
    expect(result.supportsBehaviorProof).toBe(true);
    expect(result.findings.map((finding) => finding.id)).toContain("integration_evidence_present");
  });
});
