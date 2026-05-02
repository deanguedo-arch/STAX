import fs from "node:fs/promises";
import path from "node:path";
import { summarizeBaselineCleanup, type BaselineCleanupLedger } from "./BaselineCleanup.js";

export type ClosedLoopFinalOutcome =
  | "verified_complete"
  | "verified_next_state"
  | "clean_failure"
  | "blocked_pending_evidence"
  | "rejected_fake_complete"
  | "human_review_required"
  | "bounded_stop";

export type ClosedLoopCodexTask = {
  taskId: string;
  repo: string;
  objective: string;
  staxInitialAudit: string;
  staxCodexPrompt: string;
  codexReport: string;
  diffEvidence: string;
  commandEvidence: string;
  staxPostCodexAudit: string;
  cleanupPromptsAfterCodex: number;
  finalOutcome: ClosedLoopFinalOutcome;
  falseAccept: boolean;
  falseBlock: boolean;
  usefulBlock: boolean;
  verifiedAccept: boolean;
  staxInitialPromptUseful: boolean;
  evalCandidate: boolean;
};

export type ClosedLoopCodexLedger = {
  campaignId: string;
  purpose?: string;
  tasks: ClosedLoopCodexTask[];
};

export type ClosedLoopCodexSummary = {
  campaignId: string;
  taskCount: number;
  reposRepresented: number;
  falseAccepts: number;
  falseBlocks: number;
  usefulBlocks: number;
  verifiedAccepts: number;
  usefulInitialPrompts: number;
  usefulInitialPromptRate: number;
  verifiedNextStateRate: number;
  cleanupPromptsMean: number | null;
  baselineMeanCleanupPrompts: number | null;
  cleanupReductionPct: number | null;
  evalConversionRate: number;
  status: "closed_loop_passed" | "closed_loop_blocked" | "invalid";
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

function isVerifiedNextState(outcome: ClosedLoopFinalOutcome): boolean {
  return outcome === "verified_complete" || outcome === "verified_next_state";
}

export function summarizeClosedLoopCodexCampaign(args: {
  ledger: ClosedLoopCodexLedger;
  baselineLedger?: BaselineCleanupLedger;
}): ClosedLoopCodexSummary {
  const blockers: string[] = [];
  const reposRepresented = new Set(args.ledger.tasks.map((task) => task.repo)).size;
  const falseAccepts = args.ledger.tasks.filter((task) => task.falseAccept).length;
  const falseBlocks = args.ledger.tasks.filter((task) => task.falseBlock).length;
  const usefulBlocks = args.ledger.tasks.filter((task) => task.usefulBlock).length;
  const verifiedAccepts = args.ledger.tasks.filter((task) => task.verifiedAccept).length;
  const usefulInitialPrompts = args.ledger.tasks.filter((task) => task.staxInitialPromptUseful).length;
  const usefulInitialPromptRate = pct(usefulInitialPrompts, args.ledger.tasks.length);
  const verifiedNextStateRate = pct(
    args.ledger.tasks.filter((task) => isVerifiedNextState(task.finalOutcome)).length,
    args.ledger.tasks.length
  );
  const cleanupPromptsMean = mean(args.ledger.tasks.map((task) => task.cleanupPromptsAfterCodex));
  const baselineSummary = args.baselineLedger ? summarizeBaselineCleanup(args.baselineLedger) : null;
  const baselineMeanCleanupPrompts = baselineSummary?.meanCleanupPrompts ?? null;
  let cleanupReductionPct: number | null = null;
  if (baselineMeanCleanupPrompts != null && cleanupPromptsMean != null && baselineMeanCleanupPrompts > 0) {
    cleanupReductionPct = Number((((baselineMeanCleanupPrompts - cleanupPromptsMean) / baselineMeanCleanupPrompts) * 100).toFixed(2));
  }

  const missCount = args.ledger.tasks.filter((task) => task.falseAccept || task.falseBlock || !task.staxInitialPromptUseful).length;
  const evalConversionRate = missCount === 0 ? 100 : pct(args.ledger.tasks.filter((task) => task.evalCandidate).length, missCount);

  if (args.ledger.tasks.length < 20) blockers.push("fewer than 20 closed-loop tasks recorded");
  if (reposRepresented < 3) blockers.push("fewer than 3 repos represented in closed-loop ledger");
  if (falseAccepts > 0) blockers.push("false accept recorded in closed-loop campaign");
  if (verifiedNextStateRate < 80) blockers.push("verified next-state rate is below 80 percent");
  if (cleanupReductionPct == null) blockers.push("cleanup reduction versus baseline cannot be computed yet");
  else if (cleanupReductionPct < 40) blockers.push("cleanup reduction versus baseline is below 40 percent");
  if (usefulInitialPromptRate < 90) blockers.push("useful initial prompt rate is below 90 percent");
  if (pct(falseBlocks, args.ledger.tasks.length) > 15) blockers.push("false-block rate is above 15 percent");
  if (evalConversionRate < 100) blockers.push("misses are not fully converted into eval candidates");

  const status: ClosedLoopCodexSummary["status"] =
    args.ledger.tasks.length === 0
      ? "invalid"
      : blockers.length > 0
        ? "closed_loop_blocked"
        : "closed_loop_passed";

  return {
    campaignId: args.ledger.campaignId,
    taskCount: args.ledger.tasks.length,
    reposRepresented,
    falseAccepts,
    falseBlocks,
    usefulBlocks,
    verifiedAccepts,
    usefulInitialPrompts,
    usefulInitialPromptRate,
    verifiedNextStateRate,
    cleanupPromptsMean,
    baselineMeanCleanupPrompts,
    cleanupReductionPct,
    evalConversionRate,
    status,
    blockers
  };
}

export async function validateClosedLoopCodexCampaign(input: {
  ledgerPath?: string;
  baselineLedgerPath?: string;
} = {}): Promise<{ ledgerPath: string; baselineLedgerPath: string; summary: ClosedLoopCodexSummary }> {
  const ledgerPath =
    input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "closed_loop_20_tasks.json");
  const baselineLedgerPath =
    input.baselineLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "baseline_cleanup_tasks.json");
  const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as ClosedLoopCodexLedger;
  const baselineLedger = JSON.parse(await fs.readFile(baselineLedgerPath, "utf8")) as BaselineCleanupLedger;
  return {
    ledgerPath,
    baselineLedgerPath,
    summary: summarizeClosedLoopCodexCampaign({
      ledger,
      baselineLedger
    })
  };
}
