import fs from "node:fs/promises";
import path from "node:path";
import { summarizeBaselineCleanup, type BaselineCleanupLedger } from "./BaselineCleanup.js";

export type OperatingWindowTask = {
  taskId: string;
  repo: string;
  cleanupPromptsAfterCodex: number;
  staxInitialPromptUseful: boolean;
  humanDecision: string;
  fakeCompleteCaught: boolean;
  missingProofCaught: boolean;
  wrongRepoPrevented: boolean;
  staxCriticalMiss: boolean;
  evalCandidate: boolean;
};

export type OperatingWindowLedger = {
  campaignId: string;
  tasks: OperatingWindowTask[];
};

export type OperatingWindowSummary = {
  campaignId: string;
  taskCount: number;
  reposRepresented: number;
  staxCriticalMisses: number;
  usefulInitialPromptRate: number;
  acceptedDecisionRate: number;
  meaningfulCatches: number;
  cleanupPromptsMean: number | null;
  baselineMeanCleanupPrompts: number | null;
  cleanupReductionPct: number | null;
  evalConversionRate: number;
  status: "operating_window_passed" | "operating_window_blocked" | "invalid";
  blockers: string[];
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function isAccepted(decision: string): boolean {
  return /accepted/i.test(decision);
}

export function summarizeOperatingWindow(args: {
  ledger: OperatingWindowLedger;
  baselineLedger?: BaselineCleanupLedger;
}): OperatingWindowSummary {
  const blockers: string[] = [];
  const reposRepresented = new Set(args.ledger.tasks.map((task) => task.repo)).size;
  const staxCriticalMisses = args.ledger.tasks.filter((task) => task.staxCriticalMiss).length;
  const usefulInitialPromptRate = pct(args.ledger.tasks.filter((task) => task.staxInitialPromptUseful).length, args.ledger.tasks.length);
  const acceptedDecisionRate = pct(args.ledger.tasks.filter((task) => isAccepted(task.humanDecision)).length, args.ledger.tasks.length);
  const meaningfulCatches = args.ledger.tasks.filter(
    (task) => task.fakeCompleteCaught || task.missingProofCaught || task.wrongRepoPrevented
  ).length;
  const cleanupPromptsMean = mean(args.ledger.tasks.map((task) => task.cleanupPromptsAfterCodex));
  const baselineSummary = args.baselineLedger ? summarizeBaselineCleanup(args.baselineLedger) : null;
  const baselineMeanCleanupPrompts = baselineSummary?.meanCleanupPrompts ?? null;
  let cleanupReductionPct: number | null = null;
  if (baselineMeanCleanupPrompts != null && cleanupPromptsMean != null && baselineMeanCleanupPrompts > 0) {
    cleanupReductionPct = Number((((baselineMeanCleanupPrompts - cleanupPromptsMean) / baselineMeanCleanupPrompts) * 100).toFixed(2));
  }
  const missCount = args.ledger.tasks.filter(
    (task) => task.staxCriticalMiss || !task.staxInitialPromptUseful || !isAccepted(task.humanDecision)
  ).length;
  const evalConversionRate = missCount === 0 ? 100 : pct(args.ledger.tasks.filter((task) => task.evalCandidate).length, missCount);

  if (args.ledger.tasks.length < 30) blockers.push("fewer than 30 operating-window tasks recorded");
  if (reposRepresented < 3) blockers.push("fewer than 3 repos represented in operating window");
  if (staxCriticalMisses > 0) blockers.push("STAX critical miss recorded in operating window");
  if (usefulInitialPromptRate < 85) blockers.push("useful initial prompt rate is below 85 percent");
  if (acceptedDecisionRate < 85) blockers.push("accepted decision rate is below 85 percent");
  if (meaningfulCatches < 10) blockers.push("fewer than 10 meaningful catches recorded");
  if (cleanupReductionPct == null) blockers.push("cleanup reduction versus baseline cannot be computed yet");
  else if (cleanupReductionPct < 40) blockers.push("cleanup reduction versus baseline is below 40 percent");
  if (evalConversionRate < 100) blockers.push("misses are not fully converted into eval or patch candidates");

  const status: OperatingWindowSummary["status"] =
    args.ledger.tasks.length === 0
      ? "invalid"
      : blockers.length > 0
        ? "operating_window_blocked"
        : "operating_window_passed";

  return {
    campaignId: args.ledger.campaignId,
    taskCount: args.ledger.tasks.length,
    reposRepresented,
    staxCriticalMisses,
    usefulInitialPromptRate,
    acceptedDecisionRate,
    meaningfulCatches,
    cleanupPromptsMean,
    baselineMeanCleanupPrompts,
    cleanupReductionPct,
    evalConversionRate,
    status,
    blockers
  };
}

export async function validateOperatingWindow(input: {
  ledgerPath?: string;
  baselineLedgerPath?: string;
} = {}): Promise<{ ledgerPath: string; baselineLedgerPath: string; summary: OperatingWindowSummary }> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "operating_window_30_tasks.json");
  const baselineLedgerPath =
    input.baselineLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "baseline_cleanup_tasks.json");
  const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as OperatingWindowLedger;
  const baselineLedger = JSON.parse(await fs.readFile(baselineLedgerPath, "utf8")) as BaselineCleanupLedger;
  return {
    ledgerPath,
    baselineLedgerPath,
    summary: summarizeOperatingWindow({
      ledger,
      baselineLedger
    })
  };
}
