import { loadCiFailureFixtureCases, triageCiFailure } from "../projectControl/CiFailureTriage.js";
import type { CiFailureFixtureCase } from "../projectControl/CiFailureTriage.js";
import type { CommandProofStrength } from "../evidence/CommandEvidenceIntelligenceSchemas.js";

export type CiFailureTriageGateSummary = {
  caseCount: number;
  passingCount: number;
  likelyCauseAccuracyPct: number;
  proofStrengthAccuracyPct: number;
  nextActionAccuracyPct: number;
  status: "passed" | "blocked";
  issues: string[];
};

type CiFailureTriageGateInput = {
  rootDir?: string;
};

export async function validateCiFailureTriageGate(
  input: CiFailureTriageGateInput = {}
): Promise<CiFailureTriageGateSummary> {
  const cases: CiFailureFixtureCase[] = await loadCiFailureFixtureCases(input.rootDir);
  let likelyCauseHits = 0;
  let proofStrengthHits = 0;
  let nextActionHits = 0;
  let passingCount = 0;
  const issues: string[] = [];

  for (const testCase of cases) {
    const result = triageCiFailure(testCase);
    const expectedProofStrength = testCase.expectedProofStrength as CommandProofStrength;
    const expectedCauseMatch = result.likelyCause === testCase.expectedLikelyCause;
    const expectedProofMatch = result.proofStrength === expectedProofStrength;
    const expectedActionMatch = result.nextAction.includes(testCase.expectedNextActionContains);

    if (expectedCauseMatch) likelyCauseHits += 1;
    else issues.push(`${testCase.caseId}: likely cause ${result.likelyCause} != ${testCase.expectedLikelyCause}`);

    if (expectedProofMatch) proofStrengthHits += 1;
    else issues.push(`${testCase.caseId}: proof strength ${result.proofStrength} != ${expectedProofStrength}`);

    if (expectedActionMatch) nextActionHits += 1;
    else issues.push(`${testCase.caseId}: next action missing '${testCase.expectedNextActionContains}'`);

    if (expectedCauseMatch && expectedProofMatch && expectedActionMatch) passingCount += 1;
  }

  const caseCount = cases.length;
  const likelyCauseAccuracyPct = caseCount === 0 ? 0 : Math.round((likelyCauseHits / caseCount) * 100);
  const proofStrengthAccuracyPct = caseCount === 0 ? 0 : Math.round((proofStrengthHits / caseCount) * 100);
  const nextActionAccuracyPct = caseCount === 0 ? 0 : Math.round((nextActionHits / caseCount) * 100);

  return {
    caseCount,
    passingCount,
    likelyCauseAccuracyPct,
    proofStrengthAccuracyPct,
    nextActionAccuracyPct,
    status: issues.length === 0 ? "passed" : "blocked",
    issues
  };
}
