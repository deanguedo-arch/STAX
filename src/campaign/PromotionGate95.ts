import fs from "node:fs/promises";
import path from "node:path";
import { validateComparisonRunIntegrity } from "./ComparisonIntegrity.js";
import { validateBaselineCleanupLedger } from "./BaselineCleanup.js";
import { validateDogfoodRoundC } from "./DogfoodRoundC.js";
import { validateFailureLedger } from "./FailureLedger.js";
import { validateOperatingWindow } from "./OperatingWindow.js";

export type PromotionGate95Summary = {
  cleanRunsPassed: number;
  requiredCleanRuns: number;
  baselineStatus: string;
  dogfoodRoundCStatus: string;
  failureLedgerStatus: string;
  operatingWindowStatus: string;
  status: "promotion_ready" | "promotion_blocked";
  blockers: string[];
};

type PromotionConfig = {
  requiredCleanRuns: number;
  comparisonRunIds: string[];
};

const DEFAULT_CONFIG: PromotionConfig = {
  requiredCleanRuns: 3,
  comparisonRunIds: ["phase12-stateful-2026-04-30", "phaseB-stateful-20-2026-04-30"]
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
      comparisonRunIds: raw.comparisonRunIds ?? DEFAULT_CONFIG.comparisonRunIds
    };
  } catch {
    config = DEFAULT_CONFIG;
  }

  const runResults = await Promise.all(config.comparisonRunIds.map((runId) => validateComparisonRunIntegrity({ runId })));
  const cleanRunsPassed = runResults.filter((result) => result.pass).length;
  const baseline = await validateBaselineCleanupLedger();
  const failureLedger = await validateFailureLedger();
  const dogfood = await validateDogfoodRoundC();
  const operatingWindow = await validateOperatingWindow();

  const blockers: string[] = [];
  if (cleanRunsPassed < config.requiredCleanRuns) blockers.push(`fewer than ${config.requiredCleanRuns} clean evidence runs are recorded`);
  if (baseline.summary.status !== "baseline_ready") blockers.push("baseline cleanup ledger is not ready");
  if (failureLedger.summary.status !== "tracked") blockers.push("failure ledger is not fully tracked");
  if (dogfood.summary.status !== "round_c_passed") blockers.push("fresh dogfood Round C has not passed");
  if (operatingWindow.summary.status !== "operating_window_passed") blockers.push("30-task operating window has not passed");

  return {
    cleanRunsPassed,
    requiredCleanRuns: config.requiredCleanRuns,
    baselineStatus: baseline.summary.status,
    dogfoodRoundCStatus: dogfood.summary.status,
    failureLedgerStatus: failureLedger.summary.status,
    operatingWindowStatus: operatingWindow.summary.status,
    status: blockers.length === 0 ? "promotion_ready" : "promotion_blocked",
    blockers
  };
}
