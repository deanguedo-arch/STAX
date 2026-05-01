import fs from "node:fs/promises";
import path from "node:path";

export type BaselineCleanupTask = {
  taskId: string;
  repo: string;
  task?: string;
  cleanupPromptsAfterCodex?: number | null;
  fakeCompleteCaughtManually?: boolean;
  missingProofCaughtManually?: boolean;
  wrongRepoCaughtManually?: boolean;
  finalOutcome?: string;
  notes?: string;
};

export type BaselineCleanupLedger = {
  campaignId: string;
  tasks: BaselineCleanupTask[];
};

export type BaselineCleanupSummary = {
  campaignId: string;
  taskCount: number;
  knownCleanupCounts: number;
  unknownCleanupCounts: number;
  meanCleanupPrompts: number | null;
  medianCleanupPrompts: number | null;
  fakeCompleteCaughtManually: number;
  missingProofCaughtManually: number;
  wrongRepoCaughtManually: number;
  status: "baseline_ready" | "baseline_incomplete" | "invalid";
  blockers: string[];
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (left == null || right == null) return null;
  return Number((((left + right) / 2)).toFixed(2));
}

export function summarizeBaselineCleanup(ledger: BaselineCleanupLedger): BaselineCleanupSummary {
  const cleanupCounts = ledger.tasks
    .map((task) => task.cleanupPromptsAfterCodex)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const blockers: string[] = [];

  if (ledger.tasks.length < 5) blockers.push("fewer than 5 baseline tasks recorded");
  if (cleanupCounts.length < 5) blockers.push("fewer than 5 baseline tasks have measured cleanup prompt counts");

  const status: BaselineCleanupSummary["status"] =
    ledger.tasks.length === 0
      ? "invalid"
      : blockers.length > 0
        ? "baseline_incomplete"
        : "baseline_ready";

  return {
    campaignId: ledger.campaignId,
    taskCount: ledger.tasks.length,
    knownCleanupCounts: cleanupCounts.length,
    unknownCleanupCounts: ledger.tasks.length - cleanupCounts.length,
    meanCleanupPrompts: mean(cleanupCounts),
    medianCleanupPrompts: median(cleanupCounts),
    fakeCompleteCaughtManually: ledger.tasks.filter((task) => task.fakeCompleteCaughtManually).length,
    missingProofCaughtManually: ledger.tasks.filter((task) => task.missingProofCaughtManually).length,
    wrongRepoCaughtManually: ledger.tasks.filter((task) => task.wrongRepoCaughtManually).length,
    status,
    blockers
  };
}

export async function validateBaselineCleanupLedger(input: {
  ledgerPath?: string;
} = {}): Promise<{ ledgerPath: string; summary: BaselineCleanupSummary }> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "baseline_cleanup_tasks.json");
  const raw = await fs.readFile(ledgerPath, "utf8");
  const ledger = JSON.parse(raw) as BaselineCleanupLedger;
  return {
    ledgerPath,
    summary: summarizeBaselineCleanup(ledger)
  };
}
