import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createDefaultRuntime } from "../core/RaxRuntime.js";
import type { PullRequestArtifactPacket } from "../projectControl/PullRequestArtifactPacket.js";
import { PullRequestArtifactPacketSchema } from "../projectControl/PullRequestArtifactPacket.js";
import { stringifyProjectControlEvidencePacket } from "../projectControl/ProjectControlEvidencePacket.js";

const PrArtifactSnapshotCategorySchema = z.enum([
  "passing_ci",
  "failing_ci",
  "docs_config_only",
  "tests_fixtures_goldens",
  "ui_data_deploy_security"
]);
const PrArtifactTrialProfileSchema = z.enum(["standard_50", "hard_100"]);

const ExpectedStatusSchema = z.enum(["Accept", "Reject", "Provisional", "Human review", "Clean failure"]);

const CriticalMissRuleSchema = z.enum([
  "must_surface_ci_proof_strength",
  "must_not_accept_non_successful_ci",
  "must_reject_docs_only_implementation_claim",
  "must_flag_config_only_change",
  "must_flag_test_only_or_fixture_risk",
  "must_require_visual_proof",
  "must_require_data_proof",
  "must_require_release_proof",
  "must_use_human_review_for_open_comments"
]);

const PrArtifactSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  repoFullName: z.string().min(1),
  publicUrl: z.string().url(),
  category: PrArtifactSnapshotCategorySchema,
  sourceKind: z.literal("public_github_pr_snapshot"),
  capturedAt: z.string().datetime(),
  notes: z.string().min(1),
  packet: PullRequestArtifactPacketSchema
});

const PrArtifactTrialCaseSchema = z.object({
  caseId: z.string().min(1),
  snapshotId: z.string().min(1),
  category: PrArtifactSnapshotCategorySchema,
  task: z.string().min(1),
  expectedStatus: ExpectedStatusSchema,
  expectedBestTraits: z.array(z.string().min(1)).min(1),
  criticalMissRules: z.array(CriticalMissRuleSchema).min(1),
  expectedCiProofStrength: z.string().min(1).optional(),
  expectedOutputContains: z.array(z.string().min(1)).default([])
});

const PrArtifactTrialFixtureSchema = z.object({
  fixtureSet: z.string().min(1),
  trialProfile: PrArtifactTrialProfileSchema.optional(),
  snapshots: z.array(PrArtifactSnapshotSchema).min(10),
  cases: z.array(PrArtifactTrialCaseSchema).min(50)
});

export type PrArtifactSnapshotCategory = z.infer<typeof PrArtifactSnapshotCategorySchema>;
export type PrArtifactSnapshot = z.infer<typeof PrArtifactSnapshotSchema>;
export type PrArtifactTrialCase = z.infer<typeof PrArtifactTrialCaseSchema>;
export type PrArtifactTrialFixture = z.infer<typeof PrArtifactTrialFixtureSchema>;

export type PrArtifactTrialIntegritySummary = {
  fixtureSet: string;
  snapshotCount: number;
  caseCount: number;
  categoryCounts: Record<PrArtifactSnapshotCategory, number>;
  snapshotCoverageValid: boolean;
  caseShapeValid: boolean;
  status: "passed" | "failed";
  issues: string[];
};

export type PrArtifactTrialMiss = {
  caseId: string;
  snapshotId: string;
  expectedStatus: z.infer<typeof ExpectedStatusSchema>;
  actualStatus: z.infer<typeof ExpectedStatusSchema>;
  reason: string;
  suggestedFailurePattern: string;
  suggestedEvalId: string;
};

export type PrArtifactTrialScoreSummary = {
  fixtureSet: string;
  trialProfile: z.infer<typeof PrArtifactTrialProfileSchema> | "custom";
  snapshotCount: number;
  uniquePullRequestCount: number;
  caseCount: number;
  falseAccepts: number;
  falseBlocks: number;
  falseBlockRatePct: number;
  usefulNextActions: number;
  usefulNextActionRate: number;
  ciProofClassificationAccuracy: number;
  criticalMisses: number;
  evalCandidatesCreated: number;
  misses: PrArtifactTrialMiss[];
  status: "passed" | "failed";
  blockers: string[];
};

type PrArtifactTrialLoadOptions = {
  fixturePath?: string;
};

function resolvePrArtifactFixturePath(rootDir: string, fixturePath?: string): string {
  return fixturePath ?? path.join(rootDir, "fixtures", "pr_artifact_trial", "pr_artifact_trial_50_cases.json");
}

export async function loadPrArtifactTrialFixture(
  rootDir = process.cwd(),
  options: PrArtifactTrialLoadOptions = {}
): Promise<PrArtifactTrialFixture> {
  const fixturePath = resolvePrArtifactFixturePath(rootDir, options.fixturePath);
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf8")) as unknown;
  return PrArtifactTrialFixtureSchema.parse(raw);
}

export async function validatePrArtifactTrialFixtures(
  rootDir = process.cwd(),
  options: PrArtifactTrialLoadOptions = {}
): Promise<PrArtifactTrialIntegritySummary> {
  const fixture = await loadPrArtifactTrialFixture(rootDir, options);
  const issues: string[] = [];
  const snapshotIds = new Set(fixture.snapshots.map((snapshot) => snapshot.snapshotId));
  const categoryCounts = zeroCategoryCounts();

  for (const testCase of fixture.cases) {
    categoryCounts[testCase.category] += 1;
    if (!snapshotIds.has(testCase.snapshotId)) {
      issues.push(`${testCase.caseId}: missing referenced snapshot ${testCase.snapshotId}`);
    }
  }

  for (const snapshot of fixture.snapshots) {
    if (snapshot.packet.changedFiles.length === 0 && !snapshot.packet.unifiedDiff?.trim()) {
      issues.push(`${snapshot.snapshotId}: packet must include changed files or unified diff`);
    }
  }

  const expectedCaseCountByCategory = expectedCategoryCount(fixture.cases.length, fixture.trialProfile);
  for (const category of PrArtifactSnapshotCategorySchema.options) {
    if (expectedCaseCountByCategory != null) {
      if (categoryCounts[category] !== expectedCaseCountByCategory) {
        issues.push(`category ${category} must contain exactly ${expectedCaseCountByCategory} cases`);
      }
      continue;
    }
    if (categoryCounts[category] === 0) {
      issues.push(`category ${category} must include at least one case`);
    }
  }

  return {
    fixtureSet: fixture.fixtureSet,
    snapshotCount: fixture.snapshots.length,
    caseCount: fixture.cases.length,
    categoryCounts,
    snapshotCoverageValid: issues.every((issue) => !issue.includes("missing referenced snapshot")),
    caseShapeValid: issues.length === 0,
    status: issues.length === 0 ? "passed" : "failed",
    issues
  };
}

export async function scorePrArtifactTrial(
  rootDir = process.cwd(),
  options: PrArtifactTrialLoadOptions = {}
): Promise<PrArtifactTrialScoreSummary> {
  const integrity = await validatePrArtifactTrialFixtures(rootDir, options);
  const fixture = await loadPrArtifactTrialFixture(rootDir, options);
  const runtime = await createDefaultRuntime();
  const snapshots = new Map(fixture.snapshots.map((snapshot) => [snapshot.snapshotId, snapshot]));
  const uniquePullRequestCount = new Set(
    fixture.snapshots.map((snapshot) => `${snapshot.repoFullName}#${snapshot.packet.prNumber}`)
  ).size;
  const misses: PrArtifactTrialMiss[] = [];

  let falseAccepts = 0;
  let falseBlocks = 0;
  let usefulNextActions = 0;
  let ciClassificationsChecked = 0;
  let ciClassificationsMatched = 0;
  let criticalMisses = 0;

  for (const testCase of fixture.cases) {
    const snapshot = snapshots.get(testCase.snapshotId);
    if (!snapshot) continue;

    const output = await runtime.run(
      stringifyProjectControlEvidencePacket({
        task: testCase.task,
        repo: snapshot.repoFullName,
        targetRepoPath: `/public/${snapshot.repoFullName}`,
        branch: snapshot.packet.branch,
        baseSha: snapshot.packet.baseBranch,
        headSha: snapshot.packet.commitSha,
        changedFiles: [],
        commandEvidence: [],
        codexReport: "",
        visualEvidence: [],
        dataProofArtifacts: [],
        releaseProofArtifacts: [],
        humanApproval: [],
        pullRequestArtifact: snapshot.packet
      }),
      [],
      { mode: "project_control" }
    );

    const actualStatus = extractStatus(output.output);
    const nextAction = extractSection(output.output, "## One Next Action");
    const nextActionUseful = isUsefulNextAction(nextAction);
    if (nextActionUseful) usefulNextActions += 1;

    if (testCase.expectedCiProofStrength) {
      ciClassificationsChecked += 1;
      if (output.output.includes(testCase.expectedCiProofStrength)) ciClassificationsMatched += 1;
    }

    const caseCriticalMisses = evaluateCriticalMisses(testCase, output.output, actualStatus);
    criticalMisses += caseCriticalMisses.length;

    const falseAccept = actualStatus === "Accept" && testCase.expectedStatus !== "Accept";
    const falseBlock = testCase.expectedStatus === "Accept" && actualStatus !== "Accept";
    if (falseAccept) falseAccepts += 1;
    if (falseBlock) falseBlocks += 1;

    const missingTraits = testCase.expectedBestTraits.filter((trait) => !output.output.toLowerCase().includes(trait.toLowerCase()));
    const outputMisses = [...caseCriticalMisses];
    if (missingTraits.length > 0) outputMisses.push(`missing expected trait(s): ${missingTraits.join(", ")}`);
    if (falseAccept) outputMisses.push("unexpected accept");
    if (falseBlock) outputMisses.push("unexpected block");

    if (outputMisses.length > 0) {
      misses.push({
        caseId: testCase.caseId,
        snapshotId: testCase.snapshotId,
        expectedStatus: testCase.expectedStatus,
        actualStatus,
        reason: outputMisses.join("; "),
        suggestedFailurePattern: suggestFailurePattern(testCase),
        suggestedEvalId: `eval_${testCase.caseId}`
      });
    }
  }

  const usefulNextActionRate = pct(usefulNextActions, fixture.cases.length);
  const falseBlockRatePct = pct(falseBlocks, fixture.cases.length);
  const ciProofClassificationAccuracy =
    ciClassificationsChecked === 0 ? 100 : pct(ciClassificationsMatched, ciClassificationsChecked);
  const evalCandidatesCreated = misses.length;
  const blockers = [...integrity.issues];

  if (falseAccepts > 0) blockers.push("false accepts were recorded in the PR artifact trial");
  if (falseBlockRatePct > 15) blockers.push("false-block rate is above 15 percent");
  if (usefulNextActionRate < 85) blockers.push("useful next-action rate is below 85 percent");
  if (ciProofClassificationAccuracy < 90) blockers.push("CI proof classification accuracy is below 90 percent");
  if (criticalMisses > 0) blockers.push("critical miss rules were violated");
  if (evalCandidatesCreated < misses.length) blockers.push("misses were not converted into eval candidates");

  return {
    fixtureSet: fixture.fixtureSet,
    trialProfile: fixture.trialProfile ?? "custom",
    snapshotCount: fixture.snapshots.length,
    uniquePullRequestCount,
    caseCount: fixture.cases.length,
    falseAccepts,
    falseBlocks,
    falseBlockRatePct,
    usefulNextActions,
    usefulNextActionRate,
    ciProofClassificationAccuracy,
    criticalMisses,
    evalCandidatesCreated,
    misses,
    status: blockers.length === 0 ? "passed" : "failed",
    blockers
  };
}

export function extractStatus(output: string): z.infer<typeof ExpectedStatusSchema> {
  const match = output.match(/- Status:\s*(Accept|Reject|Provisional|Human review|Clean failure)/i);
  const value = match?.[1]?.trim();
  if (value === "Accept" || value === "Reject" || value === "Provisional" || value === "Human review" || value === "Clean failure") {
    return value;
  }
  return "Reject";
}

export function extractSection(output: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`));
  return match?.[1]?.trim() ?? "";
}

export function isUsefulNextAction(nextAction: string): boolean {
  if (!nextAction) return false;
  if (/fix everything|do whatever|anything else/i.test(nextAction)) return false;
  return /\b(run|attach|supply|add|review|capture|post|confirm|rerun|compare|collect|inspect|ask)\b/i.test(nextAction);
}

export function evaluateCriticalMisses(
  testCase: PrArtifactTrialCase,
  output: string,
  actualStatus: z.infer<typeof ExpectedStatusSchema>
): string[] {
  const misses: string[] = [];
  for (const rule of testCase.criticalMissRules) {
    switch (rule) {
      case "must_surface_ci_proof_strength":
        if (!/PR CI .*: (ci_proof|failed_proof|partial_local_proof|stale_proof|wrong_branch_proof|wrong_repo_proof|not_relevant_to_claim)\./.test(output)) {
          misses.push("CI proof strength was not surfaced");
        }
        break;
      case "must_not_accept_non_successful_ci":
        if (actualStatus === "Accept") misses.push("non-successful CI case was accepted");
        break;
      case "must_reject_docs_only_implementation_claim":
        if (actualStatus === "Accept" || !output.includes("docs_only_implementation_claim")) {
          misses.push("docs-only implementation claim was not rejected correctly");
        }
        break;
      case "must_flag_config_only_change":
        if (!/config|workflow|checklist|config_policy/i.test(output)) {
          misses.push("config-only or workflow-only change was not surfaced");
        }
        break;
      case "must_flag_test_only_or_fixture_risk":
        if (!/test_only_behavior_claim|fixture|golden|snapshot|source_only_no_test_claim|runtime behavior remains unverified/i.test(output)) {
          misses.push("test-only or fixture risk was not surfaced");
        }
        break;
      case "must_require_visual_proof":
        if (!/visual proof|visual artifact|screenshot|rendered_visual_proof/i.test(output)) {
          misses.push("visual proof requirement was not surfaced");
        }
        break;
      case "must_require_data_proof":
        if (!/data proof|dry run|validation|row_count_diff|data claim is unsupported/i.test(output)) {
          misses.push("data proof requirement was not surfaced");
        }
        break;
      case "must_require_release_proof":
        if (!/rollback|release|build proof|target environment|release_deploy claim is unsupported/i.test(output)) {
          misses.push("release proof requirement was not surfaced");
        }
        break;
      case "must_use_human_review_for_open_comments":
        if (actualStatus !== "Human review") {
          misses.push("open review comments did not force human review");
        }
        break;
    }
  }
  return misses;
}

function suggestFailurePattern(testCase: PrArtifactTrialCase): string {
  if (testCase.criticalMissRules.includes("must_reject_docs_only_implementation_claim")) return "C3_DOCS_ONLY_IMPLEMENTATION";
  if (testCase.criticalMissRules.includes("must_not_accept_non_successful_ci")) return "A5_CI_STATUS_MISTAKEN_AS_LOCAL_PROOF";
  if (testCase.criticalMissRules.includes("must_flag_test_only_or_fixture_risk")) return "F4_FIXTURE_GOLDEN_TEST_RISK";
  if (testCase.criticalMissRules.includes("must_require_visual_proof")) return "G1_CSS_CHANGED_NO_SCREENSHOT";
  if (testCase.criticalMissRules.includes("must_require_data_proof")) return "H2_ROW_COUNT_OR_VALIDATION_MISSING";
  if (testCase.criticalMissRules.includes("must_require_release_proof")) return "I2_RELEASE_READY_WITHOUT_GATE";
  return "R4_REPORT_SUMMARY_MISMATCH";
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function zeroCategoryCounts(): Record<PrArtifactSnapshotCategory, number> {
  return {
    passing_ci: 0,
    failing_ci: 0,
    docs_config_only: 0,
    tests_fixtures_goldens: 0,
    ui_data_deploy_security: 0
  };
}

function expectedCategoryCount(
  caseCount: number,
  profile?: z.infer<typeof PrArtifactTrialProfileSchema>
): number | undefined {
  if (profile === "standard_50" || caseCount === 50) return 10;
  if (profile === "hard_100" || caseCount === 100) return 20;
  return undefined;
}

export function normalizeTrialPacket(packet: PullRequestArtifactPacket): PullRequestArtifactPacket {
  return PullRequestArtifactPacketSchema.parse(packet);
}
