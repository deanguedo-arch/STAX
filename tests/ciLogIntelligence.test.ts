import { describe, expect, it } from "vitest";
import { classifyCiLogEvidence, loadCiLogFixtureCases } from "../src/evidence/CiLogIntelligence.js";

describe("ci log intelligence", () => {
  it("keeps the 100-case CI log fixture gate live", async () => {
    const cases = await loadCiLogFixtureCases();
    expect(cases).toHaveLength(100);
  });

  it("classifies CI log proof strength across the fixture suite", async () => {
    const cases = await loadCiLogFixtureCases();
    for (const testCase of cases) {
      const result = classifyCiLogEvidence(testCase);
      expect(result.proofStrength, testCase.caseId).toBe(testCase.expectedProofStrength);
      expect(result.status, testCase.caseId).toBe(testCase.expectedStatus);
      expect(result.matrixState, testCase.caseId).toBe(testCase.expectedMatrixState);
    }
  });

  it("never treats failed, skipped, or cancelled CI as passing proof", async () => {
    const cases = await loadCiLogFixtureCases();
    const risky = cases.filter((testCase) =>
      ["failure", "cancelled", "skipped"].includes(testCase.conclusion)
    );
    for (const testCase of risky) {
      const result = classifyCiLogEvidence(testCase);
      expect(result.status, testCase.caseId).not.toBe("passed");
      expect(result.proofStrength, testCase.caseId).not.toBe("ci_proof");
    }
  });

  it("marks partial matrix success as partial rather than passing proof", () => {
    const result = classifyCiLogEvidence({
      workflow: "test",
      branch: "main",
      commitSha: "abc1234",
      conclusion: "success",
      summary: "workflow completed successfully",
      expectedBranch: "main",
      expectedCommitSha: "abc1234",
      expectedJobCount: 4,
      completedJobCount: 3,
      failedJobCount: 1
    });

    expect(result.status).toBe("partial");
    expect(result.proofStrength).toBe("partial_local_proof");
    expect(result.matrixState).toBe("partial");
    expect(result.flags).toContain("matrix_partial_failure");
  });

  it("flags stale or wrong-commit workflow proof", () => {
    const result = classifyCiLogEvidence({
      workflow: "test",
      branch: "main",
      commitSha: "old1234",
      conclusion: "success",
      summary: "workflow completed successfully",
      expectedBranch: "main",
      expectedCommitSha: "new1234"
    });

    expect(result.proofStrength).toBe("stale_proof");
    expect(result.flags).toContain("wrong_commit");
  });

  it("warns when CI proof only succeeded on a rerun attempt", () => {
    const result = classifyCiLogEvidence({
      workflow: "ci",
      provider: "github_actions",
      branch: "main",
      commitSha: "abc1234",
      conclusion: "success",
      summary: "workflow completed successfully",
      attempt: 3,
      expectedBranch: "main",
      expectedCommitSha: "abc1234"
    });

    expect(result.proofStrength).toBe("ci_proof");
    expect(result.flags).toContain("retried_success");
    expect(result.warnings.join("\n")).toContain("rerun attempt 3");
  });
});
