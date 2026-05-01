import fs from "node:fs/promises";
import path from "node:path";
import { summarizeBaselineCleanup, type BaselineCleanupLedger } from "./BaselineCleanup.js";
import { summarizeFailureLedger, type FailureLedger } from "./FailureLedger.js";

export type DogfoodRoundCTask = {
  taskId: string;
  repo: string;
  task: string;
  staxInitialPrompt: string;
  staxInitialPromptUseful: boolean;
  codexReport: string;
  staxAudit: string;
  fakeCompleteCaught: boolean;
  missingProofCaught: boolean;
  wrongRepoPrevented: boolean;
  cleanupPromptsAfterCodex: number;
  finalOutcome: string;
  staxCriticalMiss: boolean;
  humanDecision: string;
  evalCandidate: boolean;
  notes?: string;
};

export type DogfoodRoundCLedger = {
  campaignId: string;
  tasks: DogfoodRoundCTask[];
};

export type DogfoodRoundCSummary = {
  campaignId: string;
  taskCount: number;
  staxCriticalMisses: number;
  usefulInitialPrompts: number;
  acceptedHumanDecisions: number;
  meaningfulCatches: number;
  cleanupPromptsTotal: number;
  cleanupPromptsMean: number | null;
  baselineMeanCleanupPrompts: number | null;
  cleanupReductionPct: number | null;
  untrackedMisses: number;
  status: "round_c_passed" | "round_c_blocked" | "invalid";
  blockers: string[];
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function isAccepted(decision: string): boolean {
  return /accepted/i.test(decision);
}

function taskNeedsFailureTracking(task: DogfoodRoundCTask): boolean {
  return task.staxCriticalMiss || !task.staxInitialPromptUseful || !isAccepted(task.humanDecision);
}

export function summarizeDogfoodRoundC(args: {
  ledger: DogfoodRoundCLedger;
  baselineLedger?: BaselineCleanupLedger;
  failureLedger?: FailureLedger;
}): DogfoodRoundCSummary {
  const blockers: string[] = [];
  const staxCriticalMisses = args.ledger.tasks.filter((task) => task.staxCriticalMiss).length;
  const usefulInitialPrompts = args.ledger.tasks.filter((task) => task.staxInitialPromptUseful).length;
  const acceptedHumanDecisions = args.ledger.tasks.filter((task) => isAccepted(task.humanDecision)).length;
  const meaningfulCatches = args.ledger.tasks.filter(
    (task) => task.fakeCompleteCaught || task.missingProofCaught || task.wrongRepoPrevented
  ).length;
  const cleanupValues = args.ledger.tasks.map((task) => task.cleanupPromptsAfterCodex);
  const cleanupPromptsTotal = cleanupValues.reduce((sum, value) => sum + value, 0);
  const cleanupPromptsMean = mean(cleanupValues);

  const baselineSummary = args.baselineLedger ? summarizeBaselineCleanup(args.baselineLedger) : null;
  const baselineMeanCleanupPrompts = baselineSummary?.meanCleanupPrompts ?? null;
  let cleanupReductionPct: number | null = null;
  if (baselineMeanCleanupPrompts != null && cleanupPromptsMean != null && baselineMeanCleanupPrompts > 0) {
    cleanupReductionPct = Number((((baselineMeanCleanupPrompts - cleanupPromptsMean) / baselineMeanCleanupPrompts) * 100).toFixed(2));
  }

  let untrackedMisses = 0;
  if (args.failureLedger) {
    const failureSummary = summarizeFailureLedger({
      ledger: args.failureLedger,
      realUseLedger: {
        campaignId: args.ledger.campaignId,
        tasks: args.ledger.tasks
      }
    });
    untrackedMisses = failureSummary.missingSourceTaskIds.length;
  } else {
    untrackedMisses = args.ledger.tasks.filter(taskNeedsFailureTracking).length;
  }

  if (args.ledger.tasks.length < 10) blockers.push("fewer than 10 fresh dogfood tasks recorded");
  if (staxCriticalMisses > 0) blockers.push("STAX critical miss recorded in fresh dogfood round");
  if (usefulInitialPrompts < 8) blockers.push("fewer than 8 useful initial STAX prompts recorded");
  if (acceptedHumanDecisions < 8) blockers.push("fewer than 8 accepted human decisions recorded");
  if (meaningfulCatches < 3) blockers.push("fewer than 3 meaningful catches recorded");
  if (cleanupReductionPct == null) blockers.push("baseline cleanup reduction cannot be computed yet");
  else if (cleanupReductionPct < 30) blockers.push("cleanup reduction versus baseline is below 30 percent");
  if (untrackedMisses > 0) blockers.push("one or more fresh dogfood misses lack failure-ledger coverage");

  const status: DogfoodRoundCSummary["status"] =
    args.ledger.tasks.length === 0
      ? "invalid"
      : blockers.length > 0
        ? "round_c_blocked"
        : "round_c_passed";

  return {
    campaignId: args.ledger.campaignId,
    taskCount: args.ledger.tasks.length,
    staxCriticalMisses,
    usefulInitialPrompts,
    acceptedHumanDecisions,
    meaningfulCatches,
    cleanupPromptsTotal,
    cleanupPromptsMean,
    baselineMeanCleanupPrompts,
    cleanupReductionPct,
    untrackedMisses,
    status,
    blockers
  };
}

export async function validateDogfoodRoundC(input: {
  ledgerPath?: string;
  baselineLedgerPath?: string;
  failureLedgerPath?: string;
} = {}): Promise<{
  ledgerPath: string;
  baselineLedgerPath: string;
  failureLedgerPath: string;
  summary: DogfoodRoundCSummary;
}> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "dogfood_round_c_10_tasks.json");
  const baselineLedgerPath =
    input.baselineLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "baseline_cleanup_tasks.json");
  const failureLedgerPath = input.failureLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "failure_ledger.json");

  const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as DogfoodRoundCLedger;
  const baselineLedger = JSON.parse(await fs.readFile(baselineLedgerPath, "utf8")) as BaselineCleanupLedger;
  const failureLedger = JSON.parse(await fs.readFile(failureLedgerPath, "utf8")) as FailureLedger;

  return {
    ledgerPath,
    baselineLedgerPath,
    failureLedgerPath,
    summary: summarizeDogfoodRoundC({
      ledger,
      baselineLedger,
      failureLedger
    })
  };
}
