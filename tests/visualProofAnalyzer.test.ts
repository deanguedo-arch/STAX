import { describe, expect, it } from "vitest";
import { analyzeVisualProof, loadVisualProofFixtureCases } from "../src/evidence/VisualProofAnalyzer.js";

describe("visual proof analyzer", () => {
  it("keeps the 50-case visual-proof fixture gate live", async () => {
    const cases = await loadVisualProofFixtureCases();
    expect(cases).toHaveLength(50);
  });

  it("classifies visual proof findings across the fixture suite", async () => {
    const cases = await loadVisualProofFixtureCases();
    for (const testCase of cases) {
      const result = analyzeVisualProof(testCase);
      expect(result.verdict, testCase.caseId).toBe(testCase.expectedVerdict);
      for (const findingId of testCase.expectedFindingIds) {
        expect(result.findings.map((finding) => finding.id), testCase.caseId).toContain(findingId);
      }
    }
  });

  it("keeps false accepts at zero for weak visual proof", async () => {
    const cases = await loadVisualProofFixtureCases();
    for (const testCase of cases.filter((item) => !item.shouldCountAsStrong)) {
      const result = analyzeVisualProof(testCase);
      expect(result.verdict, testCase.caseId).not.toBe("accept");
    }
  });

  it("accepts screenshot plus checklist proof on the expected page", () => {
    const result = analyzeVisualProof({
      task: "Audit whether the Sports Wellness layout fix is proven.",
      changedFiles: ["projects/sportswellness/workspace/styles.css"],
      description: "Sports Wellness screenshot after fix with mobile responsive checklist and accessibility notes.",
      source: "rendered_screenshot",
      expectedPage: "Sports Wellness",
      checklistItems: ["text fit", "mobile responsive", "accessibility label check"],
      capturedAt: "2026-05-03T12:00:00.000Z"
    });

    expect(result.verdict).toBe("accept");
    expect(result.supportsVisualClaim).toBe(true);
  });

  it("does not require accessibility proof for a generic layout screenshot claim", () => {
    const result = analyzeVisualProof({
      task: "Audit whether the course sidebar layout fix is proven.",
      changedFiles: [],
      description: "Course sidebar screenshot with the top menu open after responsive layout fix.",
      source: "rendered_screenshot",
      checklistItems: ["course page", "top menu opens", "responsive layout checked"],
      capturedAt: "2026-05-03T12:00:00.000Z"
    });

    expect(result.verdict).toBe("accept");
    expect(result.supportsVisualClaim).toBe(true);
  });
});
