import fs from "node:fs/promises";
import path from "node:path";
import type { RealUseCampaignLedger, RealUseCampaignTask } from "./RealUseCampaignIntegrity.js";

export type FailureSeverity = "minor" | "major" | "critical";
export type FailureStatus = "eval_created" | "patch_created" | "documented_deferral" | "resolved";

export type FailureLedgerEntry = {
  failureId: string;
  sourceTaskId: string;
  failureType: string;
  severity: FailureSeverity;
  expectedBehavior: string;
  actualBehavior: string;
  patchTarget: string;
  evalCandidate: boolean;
  status: FailureStatus;
  proofReference?: string;
  deferralReason?: string;
};

export type FailureLedger = {
  campaignId: string;
  entries: FailureLedgerEntry[];
};

export type FailureLedgerSummary = {
  campaignId: string;
  requiredFailures: number;
  recordedFailures: number;
  missingSourceTaskIds: string[];
  criticalFailuresWithoutEval: string[];
  resolvedWithoutProof: string[];
  deferredWithoutReason: string[];
  status: "tracked" | "blocked" | "invalid";
  blockers: string[];
};

function isAccepted(decision: string | undefined): boolean {
  return /accepted/i.test(decision ?? "");
}

export function taskNeedsFailureRecord(task: RealUseCampaignTask): boolean {
  return Boolean(task.staxCriticalMiss || !task.staxInitialPromptUseful || !isAccepted(task.humanDecision));
}

export function summarizeFailureLedger(args: {
  ledger: FailureLedger;
  realUseLedger: RealUseCampaignLedger;
}): FailureLedgerSummary {
  const requiredTasks = args.realUseLedger.tasks.filter(taskNeedsFailureRecord);
  const bySourceTaskId = new Map(args.ledger.entries.map((entry) => [entry.sourceTaskId, entry]));
  const missingSourceTaskIds = requiredTasks
    .map((task) => task.taskId)
    .filter((taskId) => !bySourceTaskId.has(taskId));
  const criticalFailuresWithoutEval = args.ledger.entries
    .filter((entry) => entry.severity === "critical" && !entry.evalCandidate)
    .map((entry) => entry.failureId);
  const resolvedWithoutProof = args.ledger.entries
    .filter((entry) => entry.status === "resolved" && !entry.proofReference?.trim())
    .map((entry) => entry.failureId);
  const deferredWithoutReason = args.ledger.entries
    .filter((entry) => entry.status === "documented_deferral" && !entry.deferralReason?.trim())
    .map((entry) => entry.failureId);
  const blockers: string[] = [];

  if (missingSourceTaskIds.length > 0) blockers.push("one or more real-use misses lack a failure record");
  if (criticalFailuresWithoutEval.length > 0) blockers.push("critical failure recorded without eval candidate");
  if (resolvedWithoutProof.length > 0) blockers.push("resolved failure missing proof reference");
  if (deferredWithoutReason.length > 0) blockers.push("documented deferral missing reason");

  const status: FailureLedgerSummary["status"] =
    requiredTasks.length === 0
      ? "invalid"
      : blockers.length > 0
        ? "blocked"
        : "tracked";

  return {
    campaignId: args.ledger.campaignId,
    requiredFailures: requiredTasks.length,
    recordedFailures: args.ledger.entries.length,
    missingSourceTaskIds,
    criticalFailuresWithoutEval,
    resolvedWithoutProof,
    deferredWithoutReason,
    status,
    blockers
  };
}

export async function validateFailureLedger(input: {
  ledgerPath?: string;
  realUseLedgerPath?: string;
} = {}): Promise<{ ledgerPath: string; realUseLedgerPath: string; summary: FailureLedgerSummary }> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "failure_ledger.json");
  const realUseLedgerPath =
    input.realUseLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "dogfood_10_tasks_2026-04-30.json");
  const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as FailureLedger;
  const realUseLedger = JSON.parse(await fs.readFile(realUseLedgerPath, "utf8")) as RealUseCampaignLedger;

  return {
    ledgerPath,
    realUseLedgerPath,
    summary: summarizeFailureLedger({
      ledger,
      realUseLedger
    })
  };
}
