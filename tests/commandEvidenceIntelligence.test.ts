import { describe, expect, it } from "vitest";
import {
  classifyCommandEvidence,
  commandFamilyForIntelligence,
  loadCommandEvidenceFixtureCases
} from "../src/evidence/CommandEvidenceIntelligence.js";

describe("command evidence intelligence", () => {
  it("classifies command families used by messy repo proof loops", () => {
    expect(commandFamilyForIntelligence("npm run typecheck")).toBe("typecheck");
    expect(commandFamilyForIntelligence("npm test")).toBe("test");
    expect(commandFamilyForIntelligence("npm run test:e2e")).toBe("e2e");
    expect(commandFamilyForIntelligence("npm run build")).toBe("build");
    expect(commandFamilyForIntelligence("npm run rax -- eval --redteam")).toBe("redteam");
    expect(commandFamilyForIntelligence("gh run view 200")).toBe("ci");
    expect(commandFamilyForIntelligence("SYNC_ALL.cmd")).toBe("deploy");
  });

  it("keeps the 100-case command evidence fixture gate live", async () => {
    const cases = await loadCommandEvidenceFixtureCases();
    expect(cases).toHaveLength(100);
  });

  it("classifies proof strength across the fixture suite", async () => {
    const cases = await loadCommandEvidenceFixtureCases();
    const results = cases.map((testCase) => ({
      testCase,
      result: classifyCommandEvidence(testCase)
    }));
    const exactMatches = results.filter(({ testCase, result }) =>
      result.proofStrength === testCase.expectedProofStrength
    );
    const accuracy = exactMatches.length / results.length;

    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    for (const { testCase, result } of results) {
      expect(result.proofStrength, testCase.caseId).toBe(testCase.expectedProofStrength);
    }
  });

  it("has zero critical false accepts and stays within false-block budget", async () => {
    const cases = await loadCommandEvidenceFixtureCases();
    const results = cases.map((testCase) => ({
      testCase,
      result: classifyCommandEvidence(testCase)
    }));

    const falseAccepts = results.filter(({ testCase, result }) =>
      !testCase.shouldBeStrong && result.proofStrength === "strong_local_proof"
    );
    expect(falseAccepts.map(({ testCase }) => testCase.caseId)).toEqual([]);

    const strongCases = results.filter(({ testCase }) => testCase.shouldBeStrong);
    const falseBlocks = strongCases.filter(({ result }) => result.proofStrength !== "strong_local_proof");
    const falseBlockRate = falseBlocks.length / strongCases.length;
    expect(falseBlockRate).toBeLessThanOrEqual(0.1);
  });

  it("explains why wrong-repo command output is not proof", () => {
    const result = classifyCommandEvidence({
      command: "npm test",
      cwd: "/repos/stax",
      repo: "STAX",
      branch: "main",
      commitSha: "local",
      exitCode: 0,
      finishedAt: "2026-05-02T19:00:00.000Z",
      source: "local_stax_command_output",
      output: "Tests passed",
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      claimType: "tests_passed"
    });

    expect(result.proofStrength).toBe("wrong_repo_proof");
    expect(result.limitations.join(" ")).toContain("wrong repo");
  });
});
