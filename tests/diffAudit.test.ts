import { describe, expect, it } from "vitest";
import {
  auditDiffEvidence,
  classifyFileRole,
  loadDiffAuditFixtureCases
} from "../src/diffAudit/DiffAudit.js";

describe("diff audit layer", () => {
  it("classifies common file roles used in project-control proof audits", () => {
    expect(classifyFileRole("src/agents/AnalystAgent.ts")).toBe("source");
    expect(classifyFileRole("tests/projectControlMode.test.ts")).toBe("test");
    expect(classifyFileRole("docs/STAX_9_5_PROMOTION_REPORT.md")).toBe("docs");
    expect(classifyFileRole("fixtures/golden/parser.json")).toBe("fixture");
    expect(classifyFileRole("package-lock.json")).toBe("lockfile");
    expect(classifyFileRole("tools/validate-sync-surface.ps1")).toBe("script");
    expect(classifyFileRole("dist/index.js")).toBe("generated");
    expect(classifyFileRole("projects/sportswellness/workspace/styles.css")).toBe("visual_style");
  });

  it("keeps the 50-case diff-audit gate structurally live", async () => {
    const cases = await loadDiffAuditFixtureCases();
    expect(cases).toHaveLength(50);
  });

  it("detects expected proof-driving diff failure patterns", async () => {
    const cases = await loadDiffAuditFixtureCases();
    for (const testCase of cases) {
      const result = auditDiffEvidence(testCase);
      const findingIds = result.findings.map((finding) => finding.id);
      for (const expectedFindingId of testCase.expectedFindingIds) {
        expect(findingIds, testCase.caseId).toContain(expectedFindingId);
      }
      if (testCase.shouldAccept) {
        expect(result.verdict, testCase.caseId).toBe("accept");
        expect(result.findings, testCase.caseId).toEqual([]);
      }
    }
  });

  it("has zero critical false accepts and stays within the false-block budget", async () => {
    const cases = await loadDiffAuditFixtureCases();
    const results = cases.map((testCase) => ({
      testCase,
      result: auditDiffEvidence(testCase)
    }));

    const criticalFalseAccepts = results.filter(({ testCase, result }) =>
      !testCase.shouldAccept &&
      testCase.expectedFindingIds.length > 0 &&
      result.verdict === "accept"
    );
    expect(criticalFalseAccepts.map(({ testCase }) => testCase.caseId)).toEqual([]);

    const acceptCases = results.filter(({ testCase }) => testCase.shouldAccept);
    const falseBlocks = acceptCases.filter(({ result }) => result.verdict !== "accept");
    const falseBlockRate = falseBlocks.length / acceptCases.length;
    expect(falseBlockRate).toBeLessThanOrEqual(0.1);
  });

  it("produces a bounded next action instead of laundering unsupported diffs", () => {
    const result = auditDiffEvidence({
      repo: "STAX",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Implement a runtime behavior fix.",
      changedFiles: [{ path: "docs/runtime.md", changeType: "modified" }],
      claims: [{ claimType: "implementation", text: "Runtime behavior fixed.", hardClaim: true }],
      evidence: {}
    });

    expect(result.verdict).toBe("reject");
    expect(result.findings[0]?.id).toBe("docs_only_implementation_claim");
    expect(result.nextAction).toContain("Block acceptance");
  });
});
