import fixture from "../fixtures/repo_onboarding/repo_onboarding_25_cases.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import {
  buildRepoOnboardingCardFromInputs,
  formatRepoOnboardingCard
} from "../src/projectControl/RepoOnboardingAutopilot.js";

type FixtureCase = {
  caseId: string;
  repoPath?: string;
  repoFullName?: string;
  observedTopLevelFiles?: string[];
  expectedPackageManager?: string;
  expectedArchetype?: string;
  expectedVisualProofRequired?: boolean;
  expectedProofGateContains?: string;
  expectedDangerousAction?: string;
};

const cases = (fixture as { cases: FixtureCase[] }).cases;

describe("Repo onboarding autopilot", () => {
  it("builds cards that satisfy the fixture expectations", () => {
    for (const testCase of cases) {
      const card = buildRepoOnboardingCardFromInputs({
        repoPath: testCase.repoPath,
        repoFullName: testCase.repoFullName,
        observedTopLevelFiles: testCase.observedTopLevelFiles
      });

      if (testCase.expectedPackageManager) {
        expect(card.packageManager, testCase.caseId).toBe(testCase.expectedPackageManager);
      }
      if (testCase.expectedArchetype) {
        expect(card.archetype, testCase.caseId).toBe(testCase.expectedArchetype);
      }
      if (testCase.expectedVisualProofRequired !== undefined) {
        expect(card.visualProofRequired, testCase.caseId).toBe(testCase.expectedVisualProofRequired);
      }
      if (testCase.expectedProofGateContains) {
        expect(card.proofGates.join("\n"), testCase.caseId).toContain(testCase.expectedProofGateContains);
      }
      if (testCase.expectedDangerousAction) {
        expect(card.dangerousActions.join("\n"), testCase.caseId).toContain(testCase.expectedDangerousAction);
      }
      expect(card.firstSafeAuditCommand.length, testCase.caseId).toBeGreaterThan(5);
    }
  });

  it("formats a readable repo onboarding card", () => {
    const card = buildRepoOnboardingCardFromInputs({
      repoFullName: "storybookjs/storybook"
    });

    const formatted = formatRepoOnboardingCard(card);
    expect(formatted).toContain("Repo: storybookjs/storybook");
    expect(formatted).toContain("Proof Gates");
    expect(formatted).toContain("Dangerous Actions");
    expect(formatted).toContain("First Safe Audit Command");
  });
});
