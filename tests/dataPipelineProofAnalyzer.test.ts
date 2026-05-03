import { describe, expect, it } from "vitest";
import { analyzeDataPipelineProof, loadDataPipelineProofFixtureCases } from "../src/evidence/DataPipelineProofAnalyzer.js";

describe("data pipeline proof analyzer", () => {
  it("keeps the 75-case data-pipeline fixture gate live", async () => {
    const cases = await loadDataPipelineProofFixtureCases();
    expect(cases).toHaveLength(75);
  });

  it("classifies data pipeline proof findings across the fixture suite", async () => {
    const cases = await loadDataPipelineProofFixtureCases();
    for (const testCase of cases) {
      const result = analyzeDataPipelineProof(testCase);
      expect(result.verdict, testCase.caseId).toBe(testCase.expectedVerdict);
      for (const findingId of testCase.expectedFindingIds) {
        expect(result.findings.map((finding) => finding.id), testCase.caseId).toContain(findingId);
      }
    }
  });

  it("keeps false accepts at zero for weak data proof", async () => {
    const cases = await loadDataPipelineProofFixtureCases();
    for (const testCase of cases.filter((item) => !item.shouldCountAsStrong)) {
      const result = analyzeDataPipelineProof(testCase);
      expect(result.verdict, testCase.caseId).not.toBe("accept");
    }
  });

  it("accepts validation plus dry-run plus row-count evidence", () => {
    const result = analyzeDataPipelineProof({
      task: "Audit whether the admissions data publish claim is proven.",
      description: "validate-canonical passed after dry-run review and row-count diff.",
      source: "dry_run",
      rowCountBefore: 100,
      rowCountAfter: 100,
      duplicateCount: 0,
      unknownFieldCount: 0,
      dryRunPassed: true,
      validationPassed: true,
      configKind: "live"
    });

    expect(result.verdict).toBe("accept");
    expect(result.supportsDataClaim).toBe(true);
  });
});
