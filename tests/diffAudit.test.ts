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

  it("flags public API changes without tests as provisional proof", () => {
    const result = auditDiffEvidence({
      repo: "STAX",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Implement a new parser API.",
      changedFiles: [{
        path: "src/parser.ts",
        changeType: "modified",
        patch: "@@ -1 +1 @@\n-export function parse() {}\n+export function parse(input: string) {}"
      }],
      claims: [{ claimType: "implementation", text: "Parser API updated.", hardClaim: true }],
      evidence: {}
    });

    expect(result.verdict).toBe("provisional");
    expect(result.findings.map((finding) => finding.id)).toContain("public_api_change_without_tests");
  });

  it("flags dependency changes without fresh runtime proof", () => {
    const result = auditDiffEvidence({
      repo: "STAX",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Upgrade runtime dependencies.",
      changedFiles: [{
        path: "package.json",
        changeType: "modified",
        patch: "@@ -1 +1 @@\n-\"dependencies\": {}\n+\"dependencies\": {\"zod\": \"^4.0.0\"}"
      }],
      claims: [{ claimType: "implementation", text: "Dependency upgrade is ready.", hardClaim: true }],
      evidence: {}
    });

    expect(result.verdict).toBe("provisional");
    expect(result.findings.map((finding) => finding.id)).toContain("dependency_change_without_runtime_proof");
  });

  it("flags migrations without rollback proof", () => {
    const result = auditDiffEvidence({
      repo: "STAX",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Add schema migration.",
      changedFiles: [{ path: "db/migrate/20260503_add_users.ts", changeType: "added" }],
      claims: [{ claimType: "implementation", text: "Migration is ready.", hardClaim: true }],
      evidence: {}
    });

    expect(result.verdict).toBe("provisional");
    expect(result.findings.map((finding) => finding.id)).toContain("migration_without_rollback_proof");
  });

  it("flags security-sensitive changes without security proof", () => {
    const result = auditDiffEvidence({
      repo: "STAX",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Adjust auth middleware.",
      changedFiles: [{
        path: "src/security/authMiddleware.ts",
        changeType: "modified",
        patch: "@@ -1 +1 @@\n-if (!token) throw new Error('missing token')\n+if (!apiKey) throw new Error('missing api key')"
      }],
      claims: [{ claimType: "security", text: "Auth middleware updated safely.", hardClaim: true }],
      evidence: {}
    });

    expect(result.verdict).toBe("provisional");
    expect(result.findings.map((finding) => finding.id)).toContain("security_sensitive_change_without_security_proof");
  });

  it("does not require rendered visual proof for protocol text that only mentions visual proof", () => {
    const result = auditDiffEvidence({
      repo: "STAX",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Clarify sidecar visual proof instructions.",
      changedFiles: [{
        path: "src/sidecar/StaxGate.ts",
        changeType: "modified",
        patch: "@@ -1 +1 @@\n-Run the visual proof command.\n+Run visual proof collection from the STAX tooling checkout."
      }],
      claims: [{ claimType: "visual", text: "Visual proof instructions are clarified.", hardClaim: true }],
      evidence: { behaviorTestEvidence: true, commandEvidenceAfterDiff: true }
    });

    expect(result.findings.map((finding) => finding.id)).not.toContain("visual_source_without_visual_proof");
    expect(result.verdict).toBe("accept");
  });

  it("still requires rendered proof for visual claims that touch UI implementation files", () => {
    const result = auditDiffEvidence({
      repo: "canvas-helper",
      branch: "main",
      baseSha: "base-local",
      headSha: "head-local",
      objective: "Fix a rendered card layout.",
      changedFiles: [{
        path: "src/components/CourseCard.tsx",
        changeType: "modified",
        patch: "@@ -1 +1 @@\n-<div className=\"card old\" />\n+<div className=\"card compact\" />"
      }],
      claims: [{ claimType: "visual", text: "The course card layout is visually fixed.", hardClaim: true }],
      evidence: { behaviorTestEvidence: true, commandEvidenceAfterDiff: true }
    });

    expect(result.verdict).toBe("provisional");
    expect(result.findings.map((finding) => finding.id)).toContain("visual_source_without_visual_proof");
  });
});
