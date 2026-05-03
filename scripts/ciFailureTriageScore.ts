import { loadCiFailureFixtureCases, triageCiFailure } from "../src/projectControl/CiFailureTriage.js";

async function main(): Promise<void> {
  const cases = await loadCiFailureFixtureCases();
  let likelyCauseHits = 0;
  let proofStrengthHits = 0;
  let nextActionHits = 0;
  const issues: string[] = [];

  for (const testCase of cases) {
    const result = triageCiFailure(testCase);
    if (result.likelyCause === testCase.expectedLikelyCause) likelyCauseHits += 1;
    else issues.push(`${testCase.caseId}: likely cause ${result.likelyCause} != ${testCase.expectedLikelyCause}`);

    if (result.proofStrength === testCase.expectedProofStrength) proofStrengthHits += 1;
    else issues.push(`${testCase.caseId}: proof strength ${result.proofStrength} != ${testCase.expectedProofStrength}`);

    if (result.nextAction.includes(testCase.expectedNextActionContains)) nextActionHits += 1;
    else issues.push(`${testCase.caseId}: next action missing '${testCase.expectedNextActionContains}'`);
  }

  const summary = {
    caseCount: cases.length,
    likelyCauseHits,
    proofStrengthHits,
    nextActionHits,
    status: issues.length === 0 ? "passed" : "blocked",
    issues
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (issues.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
