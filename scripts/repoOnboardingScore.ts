import fixture from "../fixtures/repo_onboarding/repo_onboarding_25_cases.json" with { type: "json" };
import { buildRepoOnboardingCardFromInputs } from "../src/projectControl/RepoOnboardingAutopilot.js";

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

function main(): void {
  const cases = (fixture as { cases: FixtureCase[] }).cases;
  let packageManagerHits = 0;
  let archetypeHits = 0;
  let visualHits = 0;
  let proofGateHits = 0;
  let dangerousActionHits = 0;
  const issues: string[] = [];

  for (const testCase of cases) {
    const card = buildRepoOnboardingCardFromInputs({
      repoPath: testCase.repoPath,
      repoFullName: testCase.repoFullName,
      observedTopLevelFiles: testCase.observedTopLevelFiles
    });

    if (testCase.expectedPackageManager) {
      if (card.packageManager === testCase.expectedPackageManager) packageManagerHits += 1;
      else issues.push(`${testCase.caseId}: package manager ${card.packageManager} != ${testCase.expectedPackageManager}`);
    }
    if (testCase.expectedArchetype) {
      if (card.archetype === testCase.expectedArchetype) archetypeHits += 1;
      else issues.push(`${testCase.caseId}: archetype ${card.archetype ?? "unknown"} != ${testCase.expectedArchetype}`);
    }
    if (testCase.expectedVisualProofRequired !== undefined) {
      if (card.visualProofRequired === testCase.expectedVisualProofRequired) visualHits += 1;
      else issues.push(`${testCase.caseId}: visual proof ${card.visualProofRequired} != ${testCase.expectedVisualProofRequired}`);
    }
    if (testCase.expectedProofGateContains) {
      if (card.proofGates.join("\n").includes(testCase.expectedProofGateContains)) proofGateHits += 1;
      else issues.push(`${testCase.caseId}: missing proof gate containing ${testCase.expectedProofGateContains}`);
    }
    if (testCase.expectedDangerousAction) {
      if (card.dangerousActions.join("\n").includes(testCase.expectedDangerousAction)) dangerousActionHits += 1;
      else issues.push(`${testCase.caseId}: missing dangerous action containing ${testCase.expectedDangerousAction}`);
    }
  }

  const summary = {
    caseCount: cases.length,
    packageManagerChecks: cases.filter((item) => item.expectedPackageManager).length,
    packageManagerHits,
    archetypeChecks: cases.filter((item) => item.expectedArchetype).length,
    archetypeHits,
    visualChecks: cases.filter((item) => item.expectedVisualProofRequired !== undefined).length,
    visualHits,
    proofGateChecks: cases.filter((item) => item.expectedProofGateContains).length,
    proofGateHits,
    dangerousActionChecks: cases.filter((item) => item.expectedDangerousAction).length,
    dangerousActionHits,
    status: issues.length === 0 ? "passed" : "blocked",
    issues
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (issues.length > 0) process.exitCode = 1;
}

main();
