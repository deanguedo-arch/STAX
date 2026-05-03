import fs from "node:fs/promises";
import path from "node:path";
import { summarizeBaselineCleanup, type BaselineCleanupLedger } from "./BaselineCleanup.js";
import { summarizeClosedLoopCodexCampaign, type ClosedLoopCodexLedger } from "./ClosedLoopCodexCampaign.js";
import { summarizeDogfoodRoundC, type DogfoodRoundCLedger } from "./DogfoodRoundC.js";
import {
  summarizeFailureLedger,
  type FailureLedger,
  type FailureLedgerSummary,
  validateFailureLedger
} from "./FailureLedger.js";
import { summarizeHumanJudgmentLedger, type HumanJudgmentLedger } from "./HumanJudgmentConsole.js";
import {
  summarizeLiveCodexWorkflowContract,
  type LiveCodexWorkflowContractSummary
} from "./LiveCodexWorkflowContract.js";
import type { CiFailureTriageGateSummary } from "./CiFailureTriageGate.js";
import { validateCiFailureTriageGate } from "./CiFailureTriageGate.js";
import type { PrReviewCommentGateSummary } from "./PrReviewCommentGate.js";
import { validatePrReviewCommentGate } from "./PrReviewCommentGate.js";
import { summarizeOperatingWindow, type OperatingWindowLedger } from "./OperatingWindow.js";

export type OperatingDashboardSummary = {
  snapshotDate: string;
  statuses: {
    baseline: string;
    dogfoodRoundC: string;
    closedLoop: string;
    workflowContract: string;
    humanJudgment: string;
    failureLedger: string;
    operatingWindow: string;
    ciFailureTriage: string;
    prReviewComment: string;
  };
  metrics: {
    baselineMeanCleanupPrompts: number | null;
    dogfoodCleanupReductionPct: number | null;
    closedLoopVerifiedNextStateRate: number;
    closedLoopFalseAccepts: number;
    closedLoopFalseBlocks: number;
    workflowPromptUsableRate: number;
    workflowReportUsableRate: number;
    operatingWindowCleanupReductionPct: number | null;
    operatingWindowAcceptedDecisionRate: number;
    operatingWindowUsefulInitialPromptRate: number;
    operatingWindowMeaningfulCatches: number;
    humanJudgmentFollowupCount: number;
    humanJudgmentBlockedTooHardCount: number;
    evalCandidateCount: number;
    ciFailureTriageCaseCount: number;
    ciFailureTriagePassingCount: number;
    ciFailureTriagePassingRate: number;
    prReviewCommentCaseCount: number;
    prReviewCommentPassingCount: number;
    prReviewCommentUsefulCommentRate: number;
  };
  trendlines: string[];
  repoHotspots: Array<{ repo: string; count: number }>;
  failureHotspots: Array<{ failureType: string; count: number }>;
  nextRecommendedHardeningTask: string;
  status: "ops_healthy" | "ops_attention_needed";
  blockers: string[];
};

function topCounts<T extends string>(values: T[], limit = 3): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function pctDelta(previous: number | null, current: number | null): string {
  if (previous == null || current == null) return "n/a";
  const delta = Number((current - previous).toFixed(2));
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return `${direction} ${Math.abs(delta)}`;
}

export async function summarizeOperatingDashboard(args: {
  baselineLedger: BaselineCleanupLedger;
  dogfoodLedger: DogfoodRoundCLedger;
  failureLedger: FailureLedger;
  closedLoopLedger: ClosedLoopCodexLedger;
  humanJudgmentLedger: HumanJudgmentLedger;
  operatingWindowLedger: OperatingWindowLedger;
  failureSummary?: FailureLedgerSummary;
  workflowContractSummary?: LiveCodexWorkflowContractSummary;
  ciFailureTriageSummary?: CiFailureTriageGateSummary;
  prReviewCommentSummary?: PrReviewCommentGateSummary;
  snapshotDate?: string;
}): Promise<OperatingDashboardSummary> {
  const baseline = summarizeBaselineCleanup(args.baselineLedger);
  const failure = args.failureSummary ?? summarizeFailureLedger({
    ledger: args.failureLedger,
    realUseLedger: {
      campaignId: args.dogfoodLedger.campaignId,
      tasks: args.dogfoodLedger.tasks
    }
  });
  const dogfood = summarizeDogfoodRoundC({
    ledger: args.dogfoodLedger,
    baselineLedger: args.baselineLedger,
    failureLedger: args.failureLedger
  });
  const closedLoop = await summarizeClosedLoopCodexCampaign({
    ledger: args.closedLoopLedger,
    baselineLedger: args.baselineLedger
  });
  const workflowContract =
    args.workflowContractSummary ?? summarizeLiveCodexWorkflowContract({ ledger: args.closedLoopLedger });
  const ciFailureTriage = args.ciFailureTriageSummary ?? (await validateCiFailureTriageGate());
  const prReviewComment = args.prReviewCommentSummary ?? (await validatePrReviewCommentGate());
  const humanJudgment = summarizeHumanJudgmentLedger({
    ledger: args.humanJudgmentLedger,
    closedLoopLedger: args.closedLoopLedger
  });
  const operatingWindow = summarizeOperatingWindow({
    ledger: args.operatingWindowLedger,
    baselineLedger: args.baselineLedger
  });

  const repoHotspots = topCounts(
    args.humanJudgmentLedger.entries.filter((entry) => entry.evalCandidate || entry.humanDecision !== "accepted").map((entry) => entry.repo)
  ).map((item) => ({ repo: item.key, count: item.count }));
  const failureHotspots = topCounts(args.failureLedger.entries.map((entry) => entry.failureType)).map((item) => ({
    failureType: item.key,
    count: item.count
  }));

  const trendlines = [
    `Cleanup reduction moved from baseline to Dogfood Round C: ${dogfood.cleanupReductionPct ?? "n/a"}%.`,
    `Useful prompt rate from Dogfood Round C to Operating Window: ${pctDelta(
      Number(((dogfood.usefulInitialPrompts / Math.max(dogfood.taskCount, 1)) * 100).toFixed(2)),
      operatingWindow.usefulInitialPromptRate
    )}.`,
    `Live Codex workflow prompt/report usability: ${workflowContract.promptUsableRate}%/${workflowContract.reportUsableRate}%.`,
    `Accepted decision rate from Dogfood Round C to Operating Window: ${pctDelta(
      Number(((dogfood.acceptedHumanDecisions / Math.max(dogfood.taskCount, 1)) * 100).toFixed(2)),
      operatingWindow.acceptedDecisionRate
    )}.`,
    `Closed-loop false accepts / false blocks: ${closedLoop.falseAccepts}/${closedLoop.falseBlocks}.`
  ];

  const blockers = [
    ...baseline.blockers,
    ...dogfood.blockers,
    ...closedLoop.blockers,
    ...workflowContract.blockers,
    ...humanJudgment.blockers,
    ...failure.blockers,
    ...operatingWindow.blockers,
    ...(ciFailureTriage.status === "blocked" ? ciFailureTriage.issues : []),
    ...(prReviewComment.status === "blocked" ? prReviewComment.issues : [])
  ];

  const nextRecommendedHardeningTask =
    humanJudgment.followupCount > 0
      ? "Resolve the remaining human-judgment followup item and convert its lesson into an approved patch, eval, or repo memory target."
      : humanJudgment.blockedTooHardCount > 0
        ? "Reduce overblocking on the repo/operator slice that reviewers marked as blocked too hard."
        : failureHotspots[0]
          ? `Patch the top recurring failure pattern: ${failureHotspots[0].failureType}.`
          : repoHotspots[0]
            ? `Deepen proof coverage for the current hotspot repo: ${repoHotspots[0].repo}.`
            : "Keep dogfooding and refresh operating metrics with new real tasks.";

  return {
    snapshotDate: args.snapshotDate ?? new Date().toISOString().slice(0, 10),
    statuses: {
      baseline: baseline.status,
      dogfoodRoundC: dogfood.status,
      closedLoop: closedLoop.status,
      workflowContract: workflowContract.status,
      humanJudgment: humanJudgment.status,
      failureLedger: failure.status,
      operatingWindow: operatingWindow.status,
      ciFailureTriage: ciFailureTriage.status,
      prReviewComment: prReviewComment.status
    },
    metrics: {
      baselineMeanCleanupPrompts: baseline.meanCleanupPrompts,
      dogfoodCleanupReductionPct: dogfood.cleanupReductionPct,
      closedLoopVerifiedNextStateRate: closedLoop.verifiedNextStateRate,
      closedLoopFalseAccepts: closedLoop.falseAccepts,
      closedLoopFalseBlocks: closedLoop.falseBlocks,
      workflowPromptUsableRate: workflowContract.promptUsableRate,
      workflowReportUsableRate: workflowContract.reportUsableRate,
      operatingWindowCleanupReductionPct: operatingWindow.cleanupReductionPct,
      operatingWindowAcceptedDecisionRate: operatingWindow.acceptedDecisionRate,
      operatingWindowUsefulInitialPromptRate: operatingWindow.usefulInitialPromptRate,
      operatingWindowMeaningfulCatches: operatingWindow.meaningfulCatches,
      humanJudgmentFollowupCount: humanJudgment.followupCount,
      humanJudgmentBlockedTooHardCount: humanJudgment.blockedTooHardCount,
      evalCandidateCount: humanJudgment.evalCandidateCount,
      ciFailureTriageCaseCount: ciFailureTriage.caseCount,
      ciFailureTriagePassingCount: ciFailureTriage.passingCount,
      ciFailureTriagePassingRate:
        ciFailureTriage.caseCount === 0 ? 0 : Math.round((ciFailureTriage.passingCount / ciFailureTriage.caseCount) * 100),
      prReviewCommentCaseCount: prReviewComment.caseCount,
      prReviewCommentPassingCount: prReviewComment.passingCount,
      prReviewCommentUsefulCommentRate:
        prReviewComment.caseCount === 0 ? 0 : Math.round((prReviewComment.passingCount / prReviewComment.caseCount) * 100)
    },
    trendlines,
    repoHotspots,
    failureHotspots,
    nextRecommendedHardeningTask,
    status: blockers.length === 0 ? "ops_healthy" : "ops_attention_needed",
    blockers
  };
}

export function formatOperatingDashboard(summary: OperatingDashboardSummary): string {
  return [
    "STAX Ops Dashboard",
    `- snapshot: ${summary.snapshotDate}`,
    `- status: ${summary.status}`,
    "",
    "Status Checks",
    `- baseline: ${summary.statuses.baseline}`,
    `- dogfood round c: ${summary.statuses.dogfoodRoundC}`,
    `- closed loop: ${summary.statuses.closedLoop}`,
    `- workflow contract: ${summary.statuses.workflowContract}`,
    `- human judgment: ${summary.statuses.humanJudgment}`,
    `- failure ledger: ${summary.statuses.failureLedger}`,
    `- operating window: ${summary.statuses.operatingWindow}`,
    `- ci failure triage: ${summary.statuses.ciFailureTriage}`,
    `- pr review comment: ${summary.statuses.prReviewComment}`,
    "",
    "Key Metrics",
    `- baseline mean cleanup prompts: ${summary.metrics.baselineMeanCleanupPrompts ?? "n/a"}`,
    `- dogfood cleanup reduction: ${summary.metrics.dogfoodCleanupReductionPct ?? "n/a"}%`,
    `- closed-loop verified next-state rate: ${summary.metrics.closedLoopVerifiedNextStateRate}%`,
    `- closed-loop false accepts / false blocks: ${summary.metrics.closedLoopFalseAccepts}/${summary.metrics.closedLoopFalseBlocks}`,
    `- workflow prompt usable rate: ${summary.metrics.workflowPromptUsableRate}%`,
    `- workflow report usable rate: ${summary.metrics.workflowReportUsableRate}%`,
    `- operating-window cleanup reduction: ${summary.metrics.operatingWindowCleanupReductionPct ?? "n/a"}%`,
    `- operating-window accepted decisions: ${summary.metrics.operatingWindowAcceptedDecisionRate}%`,
    `- operating-window useful initial prompts: ${summary.metrics.operatingWindowUsefulInitialPromptRate}%`,
    `- operating-window meaningful catches: ${summary.metrics.operatingWindowMeaningfulCatches}`,
    `- ci failure triage cases / passing: ${summary.metrics.ciFailureTriageCaseCount}/${summary.metrics.ciFailureTriagePassingCount} (${summary.metrics.ciFailureTriagePassingRate}%)`,
    `- pr review comment cases / passing: ${summary.metrics.prReviewCommentCaseCount}/${summary.metrics.prReviewCommentPassingCount} (${summary.metrics.prReviewCommentUsefulCommentRate}%)`,
    `- human-judgment followups / blocked-too-hard: ${summary.metrics.humanJudgmentFollowupCount}/${summary.metrics.humanJudgmentBlockedTooHardCount}`,
    `- eval candidates: ${summary.metrics.evalCandidateCount}`,
    "",
    "Trendlines",
    ...summary.trendlines.map((item) => `- ${item}`),
    "",
    "Repo Hotspots",
    ...(summary.repoHotspots.length ? summary.repoHotspots.map((item) => `- ${item.repo}: ${item.count}`) : ["- none"]),
    "",
    "Failure Hotspots",
    ...(summary.failureHotspots.length ? summary.failureHotspots.map((item) => `- ${item.failureType}: ${item.count}`) : ["- none"]),
    "",
    "Next Recommended Hardening Task",
    `- ${summary.nextRecommendedHardeningTask}`,
    "",
    "Blockers",
    ...(summary.blockers.length ? summary.blockers.map((item) => `- ${item}`) : ["- none"])
  ].join("\n");
}

export async function validateOperatingDashboard(input: {
  baselineLedgerPath?: string;
  dogfoodLedgerPath?: string;
  failureLedgerPath?: string;
  closedLoopLedgerPath?: string;
  humanJudgmentLedgerPath?: string;
  operatingWindowLedgerPath?: string;
} = {}): Promise<OperatingDashboardSummary> {
  const baselineLedgerPath = input.baselineLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "baseline_cleanup_tasks.json");
  const dogfoodLedgerPath = input.dogfoodLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "dogfood_round_c_10_tasks.json");
  const failureLedgerPath = input.failureLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "failure_ledger.json");
  const closedLoopLedgerPath = input.closedLoopLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "closed_loop_20_tasks.json");
  const humanJudgmentLedgerPath =
    input.humanJudgmentLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "human_judgment_ledger.json");
  const operatingWindowLedgerPath =
    input.operatingWindowLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "operating_window_30_tasks.json");
  const workflowLedgerPath =
    path.join(process.cwd(), "fixtures", "real_use", "live_codex_workflow_10_tasks.json");

  const [
    baselineLedger,
    dogfoodLedger,
    failureLedger,
    closedLoopLedger,
    humanJudgmentLedger,
    operatingWindowLedger,
    failureValidation,
    ciFailureTriageSummary,
    prReviewCommentSummary,
    workflowLedger
  ] = await Promise.all([
    fs.readFile(baselineLedgerPath, "utf8").then((raw) => JSON.parse(raw) as BaselineCleanupLedger),
    fs.readFile(dogfoodLedgerPath, "utf8").then((raw) => JSON.parse(raw) as DogfoodRoundCLedger),
    fs.readFile(failureLedgerPath, "utf8").then((raw) => JSON.parse(raw) as FailureLedger),
    fs.readFile(closedLoopLedgerPath, "utf8").then((raw) => JSON.parse(raw) as ClosedLoopCodexLedger),
    fs.readFile(humanJudgmentLedgerPath, "utf8").then((raw) => JSON.parse(raw) as HumanJudgmentLedger),
    fs.readFile(operatingWindowLedgerPath, "utf8").then((raw) => JSON.parse(raw) as OperatingWindowLedger),
    validateFailureLedger(),
    validateCiFailureTriageGate(),
    validatePrReviewCommentGate(),
    fs.readFile(workflowLedgerPath, "utf8").then((raw) => JSON.parse(raw) as ClosedLoopCodexLedger)
  ]);

  return summarizeOperatingDashboard({
    baselineLedger,
    dogfoodLedger,
    failureLedger,
    closedLoopLedger,
    humanJudgmentLedger,
    operatingWindowLedger,
    failureSummary: failureValidation.summary,
    ciFailureTriageSummary,
    prReviewCommentSummary,
    workflowContractSummary: summarizeLiveCodexWorkflowContract({ ledger: workflowLedger })
  });
}
