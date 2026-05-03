import { describe, expect, it } from "vitest";
import { loadCiFailureFixtureCases, triageCiFailure } from "../src/projectControl/CiFailureTriage.js";

describe("CI failure triage", () => {
  it("keeps the 24-case CI failure triage fixture gate live", async () => {
    const cases = await loadCiFailureFixtureCases();
    expect(cases).toHaveLength(24);
  });

  it("triages likely cause and next action across the fixture suite", async () => {
    const cases = await loadCiFailureFixtureCases();
    for (const testCase of cases) {
      const result = triageCiFailure(testCase);
      expect(result.likelyCause, testCase.caseId).toBe(testCase.expectedLikelyCause);
      expect(result.proofStrength, testCase.caseId).toBe(testCase.expectedProofStrength);
      expect(result.nextAction, testCase.caseId).toContain(testCase.expectedNextActionContains);
      expect(result.codexPrompt, testCase.caseId).toContain("Work only in");
      expect(result.codexPrompt, testCase.caseId).toContain("Do not widen scope");
    }
  });

  it("turns wrong commit CI into stale-proof triage", () => {
    const result = triageCiFailure({
      repo: "STAX",
      workflow: "ci",
      provider: "github_actions",
      branch: "main",
      commitSha: "old1234",
      expectedCommitSha: "new1234",
      conclusion: "success",
      summary: "workflow completed successfully"
    });

    expect(result.likelyCause).toBe("wrong_commit");
    expect(result.proofStrength).toBe("stale_proof");
    expect(result.nextAction).toContain("head commit");
  });
});
