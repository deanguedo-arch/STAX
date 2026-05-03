import fs from "node:fs/promises";
import path from "node:path";
import { validateComparisonRunIntegrity } from "./ComparisonIntegrity.js";
import { validateBaselineCleanupLedger } from "./BaselineCleanup.js";
import { validateDogfoodRoundC } from "./DogfoodRoundC.js";
import { validateFailureLedger } from "./FailureLedger.js";
import { validateHumanJudgmentLedger } from "./HumanJudgmentConsole.js";
import { validateLiveCodexWorkflowContract } from "./LiveCodexWorkflowContract.js";
import { validateCiFailureTriageGate } from "./CiFailureTriageGate.js";
import { validatePrReviewCommentGate } from "./PrReviewCommentGate.js";
import { validateOperatingWindow } from "./OperatingWindow.js";

export type PromotionGate95Summary = {
  cleanRunsPassed: number;
  requiredCleanRuns: number;
  baselineStatus: string;
  dogfoodRoundCStatus: string;
  failureLedgerStatus: string;
  workflowContractStatus: string;
  humanJudgmentStatus: string;
  operatingWindowStatus: string;
  ciFailureTriageStatus: string;
  prReviewCommentStatus: string;
  status: "promotion_ready" | "promotion_blocked";
  blockers: string[];
};

type PromotionConfig = {
  requiredCleanRuns: number;
  comparisonRunIds: string[];
  requireCiFailureTriage?: boolean;
  requirePrReviewCommentScore?: boolean;
};

const DEFAULT_CONFIG: PromotionConfig = {
  requiredCleanRuns: 3,
  comparisonRunIds: ["phase12-stateful-2026-04-30", "phaseB-stateful-20-2026-04-30"],
  requireCiFailureTriage: true,
  requirePrReviewCommentScore: true
};

export async function evaluatePromotionGate95(input: {
  configPath?: string;
} = {}): Promise<PromotionGate95Summary> {
  const configPath = input.configPath ?? path.join(process.cwd(), "fixtures", "real_use", "promotion_gate_config.json");
  let config = DEFAULT_CONFIG;
  try {
    const raw = JSON.parse(await fs.readFile(configPath, "utf8")) as Partial<PromotionConfig>;
    config = {
      requiredCleanRuns: raw.requiredCleanRuns ?? DEFAULT_CONFIG.requiredCleanRuns,
      comparisonRunIds: raw.comparisonRunIds ?? DEFAULT_CONFIG.comparisonRunIds,
      requireCiFailureTriage: raw.requireCiFailureTriage ?? DEFAULT_CONFIG.requireCiFailureTriage,
      requirePrReviewCommentScore: raw.requirePrReviewCommentScore ?? DEFAULT_CONFIG.requirePrReviewCommentScore
    };
  } catch {
    config = DEFAULT_CONFIG;
  }

  const runResults = await Promise.all(config.comparisonRunIds.map((runId) => validateComparisonRunIntegrity({ runId })));
  const cleanRunsPassed = runResults.filter((result) => result.pass).length;
  const baseline = await validateBaselineCleanupLedger();
  const failureLedger = await validateFailureLedger();
  const dogfood = await validateDogfoodRoundC();
  const workflowContract = await validateLiveCodexWorkflowContract();
  const humanJudgment = await validateHumanJudgmentLedger();
  const operatingWindow = await validateOperatingWindow();
  const ciFailureTriage = config.requireCiFailureTriage === false ? undefined : await validateCiFailureTriageGate();
  const prReviewComment = config.requirePrReviewCommentScore === false ? undefined : await validatePrReviewCommentGate();

  const blockers: string[] = [];
  if (cleanRunsPassed < config.requiredCleanRuns) blockers.push(`fewer than ${config.requiredCleanRuns} clean evidence runs are recorded`);
  if (baseline.summary.status !== "baseline_ready") blockers.push("baseline cleanup ledger is not ready");
  if (failureLedger.summary.status !== "tracked") blockers.push("failure ledger is not fully tracked");
  if (dogfood.summary.status !== "round_c_passed") blockers.push("fresh dogfood Round C has not passed");
  if (workflowContract.status !== "workflow_contract_passed") blockers.push("live Codex workflow contract campaign has not passed");
  if (humanJudgment.summary.status !== "judgment_ready") blockers.push("human judgment ledger is not fully recorded");
  if (operatingWindow.summary.status !== "operating_window_passed") blockers.push("30-task operating window has not passed");
  if (ciFailureTriage?.status !== "passed") blockers.push("CI failure triage score is not fully passed");
  if (prReviewComment?.status !== "passed") blockers.push("PR review comment score is not fully passed");

  return {
    cleanRunsPassed,
    requiredCleanRuns: config.requiredCleanRuns,
    baselineStatus: baseline.summary.status,
    dogfoodRoundCStatus: dogfood.summary.status,
    failureLedgerStatus: failureLedger.summary.status,
    workflowContractStatus: workflowContract.status,
    humanJudgmentStatus: humanJudgment.summary.status,
    operatingWindowStatus: operatingWindow.summary.status,
    ciFailureTriageStatus: ciFailureTriage?.status ?? "not_required",
    prReviewCommentStatus: prReviewComment?.status ?? "not_required",
    status: blockers.length === 0 ? "promotion_ready" : "promotion_blocked",
    blockers
  };
}
