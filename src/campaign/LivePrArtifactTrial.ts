import path from "node:path";
import { createDefaultRuntime } from "../core/RaxRuntime.js";
import { fetchGitHubPullRequestArtifactPacket } from "../projectControl/GitHubPrArtifactAdapter.js";
import {
  stringifyProjectControlEvidencePacket,
  type PullRequestArtifactPacket
} from "../projectControl/ProjectControlEvidencePacket.js";
import {
  extractSection,
  extractStatus,
  isUsefulNextAction,
  loadPrArtifactTrialFixture,
  type PrArtifactSnapshot,
  type PrArtifactTrialCase
} from "./PrArtifactTrial.js";

type PullRequestArtifactFetchResult = Awaited<
  ReturnType<typeof fetchGitHubPullRequestArtifactPacket>
>;

export type LivePrArtifactTrialCaseResult = {
  caseId: string;
  snapshotId: string;
  repoFullName: string;
  prNumber: number;
  source: PullRequestArtifactFetchResult["source"];
  expectedStatus: PrArtifactTrialCase["expectedStatus"];
  actualStatus: PrArtifactTrialCase["expectedStatus"];
  usefulNextAction: boolean;
  ciProofSurfaced: boolean;
  falseAccept: boolean;
  falseBlock: boolean;
  warnings: string[];
  issues: string[];
};

export type LivePrArtifactTrialSummary = {
  fixtureSet: string;
  recordedAt: string;
  selectedCaseCount: number;
  requestedCaseCount: number;
  liveSourceCount: number;
  fallbackSourceCount: number;
  falseAccepts: number;
  falseBlocks: number;
  falseBlockRatePct: number;
  usefulNextActionRate: number;
  ciProofClassificationSurfaceRate: number;
  status: "passed" | "failed";
  blockers: string[];
  cases: LivePrArtifactTrialCaseResult[];
};

type LivePrArtifactTrialOptions = {
  rootDir?: string;
  requestedCaseCount?: number;
  minimumLiveSourceCount?: number;
  allowFallbackSource?: boolean;
  fixturePath?: string;
  fetchPacket?: typeof fetchGitHubPullRequestArtifactPacket;
  runAudit?: (input: {
    testCase: PrArtifactTrialCase;
    snapshot: PrArtifactSnapshot;
    fetched: PullRequestArtifactFetchResult;
  }) => Promise<string>;
};

const CI_PROOF_RE = /PR CI .*: (ci_proof|failed_proof|partial_local_proof|stale_proof|wrong_branch_proof|wrong_repo_proof|not_relevant_to_claim)\./;

export async function runLivePrArtifactTrial(
  options: LivePrArtifactTrialOptions = {}
): Promise<LivePrArtifactTrialSummary> {
  const rootDir = options.rootDir ?? process.cwd();
  const requestedCaseCount = options.requestedCaseCount ?? 25;
  const minimumLiveSourceCount = options.minimumLiveSourceCount ?? 5;
  const allowFallbackSource = options.allowFallbackSource ?? true;
  const fetchPacket = options.fetchPacket ?? fetchGitHubPullRequestArtifactPacket;
  const fixturePath =
    options.fixturePath ??
    (requestedCaseCount > 50
      ? path.join(rootDir, "fixtures", "pr_artifact_trial", "pr_artifact_trial_100_cases.json")
      : undefined);
  const fixture = await loadPrArtifactTrialFixture(rootDir, { fixturePath });
  const selectedCases = fixture.cases.slice(0, requestedCaseCount);
  const snapshotsById = new Map(fixture.snapshots.map((snapshot) => [snapshot.snapshotId, snapshot]));
  const fetchCache = new Map<string, PullRequestArtifactFetchResult>();
  const runtime = options.runAudit ? undefined : await createDefaultRuntime();
  let rateLimitFallbackMode = false;

  let liveSourceCount = 0;
  let fallbackSourceCount = 0;
  let falseAccepts = 0;
  let falseBlocks = 0;
  let usefulNextActions = 0;
  let ciProofSurfacedCount = 0;
  const blockers: string[] = [];
  const results: LivePrArtifactTrialCaseResult[] = [];

  for (const testCase of selectedCases) {
    const snapshot = snapshotsById.get(testCase.snapshotId);
    if (!snapshot) {
      blockers.push(`${testCase.caseId}: missing snapshot ${testCase.snapshotId}`);
      continue;
    }
    const key = `${snapshot.repoFullName}#${snapshot.packet.prNumber}`;
    let fetched = fetchCache.get(key);
    if (!fetched) {
      fetched = await fetchPacket(
        {
          repoFullName: snapshot.repoFullName,
          prNumber: snapshot.packet.prNumber
        },
        {
          rootDir,
          mode: "live_trial",
          preferRecordedSnapshot: rateLimitFallbackMode
        }
      );
      fetchCache.set(key, fetched);
      if (fetched.warnings.some((warning) => /rate limit exceeded/i.test(warning))) {
        rateLimitFallbackMode = true;
      }
    }

    if (fetched.source === "live_github_api") liveSourceCount += 1;
    else fallbackSourceCount += 1;

    const output = options.runAudit
      ? await options.runAudit({ testCase, snapshot, fetched })
      : (
          await runtime!.run(
            stringifyProjectControlEvidencePacket({
              task: testCase.task,
              repo: snapshot.repoFullName,
              targetRepoPath: `/public/${snapshot.repoFullName}`,
              branch: fetched.packet.branch,
              baseSha: fetched.packet.baseBranch,
              headSha: fetched.packet.commitSha,
              changedFiles: [],
              commandEvidence: [],
              codexReport: "",
              visualEvidence: [],
              dataProofArtifacts: [],
              releaseProofArtifacts: [],
              humanApproval: [],
              pullRequestArtifact: fetched.packet as PullRequestArtifactPacket
            }),
            [],
            { mode: "project_control" }
          )
        ).output;

    const actualStatus = extractStatus(output);
    const nextAction = extractSection(output, "## One Next Action");
    const usefulNextAction = isUsefulNextAction(nextAction);
    if (usefulNextAction) usefulNextActions += 1;
    const ciProofSurfaced = CI_PROOF_RE.test(output);
    if (ciProofSurfaced) ciProofSurfacedCount += 1;

    const falseAccept = actualStatus === "Accept" && testCase.expectedStatus !== "Accept";
    const falseBlock = testCase.expectedStatus === "Accept" && actualStatus !== "Accept";
    if (falseAccept) falseAccepts += 1;
    if (falseBlock) falseBlocks += 1;

    const caseIssues: string[] = [];
    if (!usefulNextAction) caseIssues.push("next action is missing or not actionable");
    if (!ciProofSurfaced) caseIssues.push("CI proof-strength line not surfaced in output");
    if (falseAccept) caseIssues.push("unexpected accept against expected fixture status");
    if (falseBlock) caseIssues.push("unexpected block against expected fixture status");
    if (!allowFallbackSource && fetched.source !== "live_github_api") {
      caseIssues.push("fallback snapshot source used while disallowed");
    }

    results.push({
      caseId: testCase.caseId,
      snapshotId: testCase.snapshotId,
      repoFullName: snapshot.repoFullName,
      prNumber: snapshot.packet.prNumber,
      source: fetched.source,
      expectedStatus: testCase.expectedStatus,
      actualStatus,
      usefulNextAction,
      ciProofSurfaced,
      falseAccept,
      falseBlock,
      warnings: fetched.warnings,
      issues: caseIssues
    });
  }

  const usefulNextActionRate = pct(usefulNextActions, selectedCases.length);
  const falseBlockRatePct = pct(falseBlocks, selectedCases.length);
  const ciProofClassificationSurfaceRate = pct(ciProofSurfacedCount, selectedCases.length);

  if (selectedCases.length < requestedCaseCount) {
    blockers.push(`requested ${requestedCaseCount} cases but only ${selectedCases.length} are available`);
  }
  if (liveSourceCount < minimumLiveSourceCount) {
    blockers.push(`live-source coverage too low: ${liveSourceCount}/${selectedCases.length} (minimum ${minimumLiveSourceCount})`);
    const retryAfter = findRateLimitRetryAfter(results);
    if (retryAfter) {
      blockers.push(`live GitHub API likely rate limited; retry after ${retryAfter}`);
    }
  }
  if (!allowFallbackSource && fallbackSourceCount > 0) {
    blockers.push(`fallback snapshot source used in ${fallbackSourceCount} case(s)`);
  }
  if (falseAccepts > 0) blockers.push("false accepts were recorded during the live PR trial");
  if (falseBlockRatePct > 15) blockers.push("false-block rate exceeded 15 percent");
  if (usefulNextActionRate < 85) blockers.push("useful next-action rate fell below 85 percent");
  if (ciProofClassificationSurfaceRate < 90) blockers.push("CI proof classification surfaced below 90 percent");

  return {
    fixtureSet: fixture.fixtureSet,
    recordedAt: new Date().toISOString(),
    selectedCaseCount: selectedCases.length,
    requestedCaseCount,
    liveSourceCount,
    fallbackSourceCount,
    falseAccepts,
    falseBlocks,
    falseBlockRatePct,
    usefulNextActionRate,
    ciProofClassificationSurfaceRate,
    status: blockers.length === 0 ? "passed" : "failed",
    blockers,
    cases: results
  };
}

export function formatLivePrArtifactTrial(summary: LivePrArtifactTrialSummary): string {
  return [
    "Live PR Artifact Trial",
    `- fixture set: ${summary.fixtureSet}`,
    `- recorded at: ${summary.recordedAt}`,
    `- selected/requested cases: ${summary.selectedCaseCount}/${summary.requestedCaseCount}`,
    `- live source cases: ${summary.liveSourceCount}`,
    `- fallback source cases: ${summary.fallbackSourceCount}`,
    `- false accepts: ${summary.falseAccepts}`,
    `- false blocks: ${summary.falseBlocks} (${summary.falseBlockRatePct}%)`,
    `- useful next-action rate: ${summary.usefulNextActionRate}%`,
    `- CI proof surface rate: ${summary.ciProofClassificationSurfaceRate}%`,
    `- status: ${summary.status}`,
    "Blockers:",
    ...(summary.blockers.length > 0 ? summary.blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n");
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function findRateLimitRetryAfter(cases: LivePrArtifactTrialCaseResult[]): string | undefined {
  const resets: number[] = [];
  for (const item of cases) {
    for (const warning of item.warnings) {
      if (!/rate limit exceeded/i.test(warning)) continue;
      const match = warning.match(/reset_at=([0-9TZ:\-.]+Z)/i);
      if (!match) continue;
      const unixMs = Date.parse(match[1]);
      if (Number.isFinite(unixMs) && unixMs > 0) resets.push(unixMs);
    }
  }
  if (resets.length === 0) return undefined;
  return new Date(Math.max(...resets)).toISOString();
}
