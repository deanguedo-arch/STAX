import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const TransferLevelSchema = z.enum(["high", "medium", "low"]);

export const FailurePatternSchema = z.object({
  patternId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  badClaim: z.string().min(1),
  expectedStaxBehavior: z.string().min(1),
  criticalMiss: z.boolean(),
  transferLevel: TransferLevelSchema,
  suggestedEvalType: z.string().min(1),
  exampleRepos: z.array(z.string().min(1)).min(1),
  positiveExample: z.object({
    input: z.string().min(1),
    expected: z.string().min(1)
  }),
  negativeExample: z.object({
    input: z.string().min(1),
    expectedFailure: z.string().min(1)
  })
});

export const FailurePatternFileSchema = z.object({
  patterns: z.array(FailurePatternSchema).min(1)
});

export const RepoArchetypeSchema = z.object({
  archetype: z.string().min(1),
  indicators: z.array(z.string().min(1)).min(1),
  proofGates: z.array(z.string().min(1)).min(1),
  dangerousActions: z.array(z.string().min(1)).min(1),
  likelyEnvironmentBlockers: z.array(z.string().min(1)).min(1),
  failurePatternsToTest: z.array(z.string().min(1)).min(1)
});

export const RepoCandidateSchema = z.object({
  repoFullName: z.string().min(1),
  archetype: z.string().min(1),
  whySelected: z.string().min(1),
  expectedProofGates: z.array(z.string().min(1)).min(1),
  highRiskPatterns: z.array(z.string().min(1)).min(1),
  fullLocalTestsLikelyTooExpensive: z.boolean(),
  recommendedFirstBoundedAuditTask: z.string().min(1)
});

export const TransferTrialCaseSchema = z.object({
  caseId: z.string().min(1),
  repoFullName: z.string().min(1),
  archetype: z.string().min(1),
  taskType: z.string().min(1),
  task: z.string().min(1),
  suppliedEvidence: z.string().min(1),
  expectedBestTraits: z.array(z.string().min(1)).min(1),
  criticalMissRules: z.array(z.string().min(1)).min(1)
});

export type RepoTransferIntegritySummary = {
  status: "passed" | "failed";
  patternFiles: number;
  patternCount: number;
  archetypeCount: number;
  candidateRepoCount: number;
  transferTrialCaseCount: number;
  archetypeCoverage: number;
  patternCategories: string[];
  issues: string[];
};

export type RepoTransferScoreSummary = {
  status: "not_scored_no_external_baseline" | "scored";
  totalCases: number;
  staxWins: number;
  staxLosses: number;
  ties: number;
  criticalMisses: number;
  usefulInitialPromptRate: number | null;
  acceptedDecisionRate: number | null;
  patternCoverage: {
    patternCount: number;
    categoryCount: number;
    highTransferPatterns: number;
    criticalMissPatterns: number;
  };
  archetypeCoverage: {
    archetypeCount: number;
    candidateRepoCount: number;
    transferCaseCount: number;
  };
  missesByPattern: Record<string, number>;
};

type RepoTransferFixtures = {
  patternFiles: Array<{ filename: string; patterns: z.infer<typeof FailurePatternSchema>[] }>;
  archetypes: z.infer<typeof RepoArchetypeSchema>[];
  candidates: z.infer<typeof RepoCandidateSchema>[];
  cases: z.infer<typeof TransferTrialCaseSchema>[];
};

export async function validateRepoTransferFixtures(rootDir = process.cwd()): Promise<RepoTransferIntegritySummary> {
  const fixtures = await loadRepoTransferFixtures(rootDir);
  const issues: string[] = [];
  const patternIds = new Set<string>();
  const categories = new Set<string>();
  const archetypeNames = new Set(fixtures.archetypes.map((item) => item.archetype));
  const candidateRepos = new Set(fixtures.candidates.map((item) => item.repoFullName));

  for (const file of fixtures.patternFiles) {
    for (const pattern of file.patterns) {
      if (patternIds.has(pattern.patternId)) issues.push(`duplicate patternId: ${pattern.patternId}`);
      patternIds.add(pattern.patternId);
      categories.add(pattern.category);
      if (!pattern.expectedStaxBehavior.trim()) issues.push(`${pattern.patternId} lacks expectedStaxBehavior`);
      if (!pattern.positiveExample?.input || !pattern.negativeExample?.input) issues.push(`${pattern.patternId} lacks examples`);
    }
  }

  for (const archetype of fixtures.archetypes) {
    for (const patternId of archetype.failurePatternsToTest) {
      if (!patternIds.has(patternId)) issues.push(`${archetype.archetype} references unknown pattern ${patternId}`);
    }
  }

  for (const candidate of fixtures.candidates) {
    if (!archetypeNames.has(candidate.archetype)) issues.push(`${candidate.repoFullName} references unknown archetype ${candidate.archetype}`);
    if (!candidate.whySelected.trim()) issues.push(`${candidate.repoFullName} lacks whySelected`);
  }

  const casesByRepo = new Map<string, number>();
  const caseIds = new Set<string>();
  for (const testCase of fixtures.cases) {
    if (caseIds.has(testCase.caseId)) issues.push(`duplicate caseId: ${testCase.caseId}`);
    caseIds.add(testCase.caseId);
    if (!archetypeNames.has(testCase.archetype)) issues.push(`${testCase.caseId} references unknown archetype ${testCase.archetype}`);
    if (!candidateRepos.has(testCase.repoFullName)) issues.push(`${testCase.caseId} references unknown candidate repo ${testCase.repoFullName}`);
    if (!testCase.expectedBestTraits.length) issues.push(`${testCase.caseId} lacks expectedBestTraits`);
    if (!testCase.criticalMissRules.length) issues.push(`${testCase.caseId} lacks criticalMissRules`);
    casesByRepo.set(testCase.repoFullName, (casesByRepo.get(testCase.repoFullName) ?? 0) + 1);
  }

  for (const candidate of fixtures.candidates) {
    const count = casesByRepo.get(candidate.repoFullName) ?? 0;
    if (count !== 5) issues.push(`${candidate.repoFullName} must have exactly 5 transfer cases; found ${count}`);
  }

  return {
    status: issues.length ? "failed" : "passed",
    patternFiles: fixtures.patternFiles.length,
    patternCount: patternIds.size,
    archetypeCount: fixtures.archetypes.length,
    candidateRepoCount: fixtures.candidates.length,
    transferTrialCaseCount: fixtures.cases.length,
    archetypeCoverage: new Set(fixtures.cases.map((item) => item.archetype)).size,
    patternCategories: [...categories].sort(),
    issues
  };
}

export async function scoreRepoTransferTrial(rootDir = process.cwd()): Promise<RepoTransferScoreSummary> {
  const fixtures = await loadRepoTransferFixtures(rootDir);
  const allPatterns = fixtures.patternFiles.flatMap((file) => file.patterns);
  const categories = new Set(allPatterns.map((pattern) => pattern.category));
  return {
    status: "not_scored_no_external_baseline",
    totalCases: fixtures.cases.length,
    staxWins: 0,
    staxLosses: 0,
    ties: 0,
    criticalMisses: 0,
    usefulInitialPromptRate: null,
    acceptedDecisionRate: null,
    patternCoverage: {
      patternCount: allPatterns.length,
      categoryCount: categories.size,
      highTransferPatterns: allPatterns.filter((pattern) => pattern.transferLevel === "high").length,
      criticalMissPatterns: allPatterns.filter((pattern) => pattern.criticalMiss).length
    },
    archetypeCoverage: {
      archetypeCount: fixtures.archetypes.length,
      candidateRepoCount: fixtures.candidates.length,
      transferCaseCount: fixtures.cases.length
    },
    missesByPattern: {}
  };
}

async function loadRepoTransferFixtures(rootDir: string): Promise<RepoTransferFixtures> {
  const failureDir = path.join(rootDir, "fixtures", "failure_patterns");
  const patternFiles = await Promise.all(
    (await fs.readdir(failureDir))
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(async (filename) => {
        const raw = JSON.parse(await fs.readFile(path.join(failureDir, filename), "utf8")) as unknown;
        return {
          filename,
          patterns: FailurePatternFileSchema.parse(raw).patterns
        };
      })
  );

  const archetypeRaw = JSON.parse(
    await fs.readFile(path.join(rootDir, "fixtures", "repo_transfer", "repo_archetypes.json"), "utf8")
  ) as unknown;
  const candidateRaw = JSON.parse(
    await fs.readFile(path.join(rootDir, "fixtures", "repo_transfer", "public_repo_candidates.json"), "utf8")
  ) as unknown;
  const casesRaw = JSON.parse(
    await fs.readFile(path.join(rootDir, "fixtures", "repo_transfer", "transfer_trial_12x5_cases.json"), "utf8")
  ) as unknown;

  return {
    patternFiles,
    archetypes: z.object({ archetypes: z.array(RepoArchetypeSchema).min(1) }).parse(archetypeRaw).archetypes,
    candidates: z.object({ candidates: z.array(RepoCandidateSchema).min(1) }).parse(candidateRaw).candidates,
    cases: z.object({ trialId: z.string().min(1), cases: z.array(TransferTrialCaseSchema).min(1) }).parse(casesRaw).cases
  };
}
