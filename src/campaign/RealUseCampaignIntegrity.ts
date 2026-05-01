import fs from "node:fs/promises";
import path from "node:path";

export type RealUseCampaignTask = {
  taskId: string;
  repo: string;
  task?: string;
  staxInitialPromptUseful?: boolean;
  staxReportAudited?: boolean;
  fakeCompleteCaught?: boolean;
  missingProofCaught?: boolean;
  wrongRepoPrevented?: boolean;
  cleanupPromptsAfterCodex?: number;
  finalOutcome?: string;
  staxCriticalMiss?: boolean;
  humanDecision?: string;
  evalCandidate?: boolean;
};

export type RealUseCampaignLedger = {
  campaignId: string;
  tasks: RealUseCampaignTask[];
};

export type RealUseCampaignSummary = {
  campaignId: string;
  taskCount: number;
  reposRepresented: number;
  staxCriticalMisses: number;
  meaningfulCatches: number;
  fakeCompleteCaught: number;
  missingProofCaught: number;
  wrongRepoPrevented: number;
  cleanupPromptsAfterCodex: number;
  usefulInitialPrompts: number;
  acceptedHumanDecisions: number;
  evalCandidates: number;
  status: "real_use_useful" | "real_use_candidate" | "promotion_blocked" | "invalid";
  blockers: string[];
};

function isAccepted(decision: string | undefined): boolean {
  return /accepted/i.test(decision ?? "");
}

export function summarizeRealUseCampaign(ledger: RealUseCampaignLedger): RealUseCampaignSummary {
  const repos = new Set(ledger.tasks.map((task) => task.repo).filter(Boolean));
  const staxCriticalMisses = ledger.tasks.filter((task) => task.staxCriticalMiss).length;
  const fakeCompleteCaught = ledger.tasks.filter((task) => task.fakeCompleteCaught).length;
  const missingProofCaught = ledger.tasks.filter((task) => task.missingProofCaught).length;
  const wrongRepoPrevented = ledger.tasks.filter((task) => task.wrongRepoPrevented).length;
  const meaningfulCatches = ledger.tasks.filter(
    (task) => task.fakeCompleteCaught || task.missingProofCaught || task.wrongRepoPrevented
  ).length;
  const cleanupPromptsAfterCodex = ledger.tasks.reduce((sum, task) => sum + (task.cleanupPromptsAfterCodex ?? 0), 0);
  const usefulInitialPrompts = ledger.tasks.filter((task) => task.staxInitialPromptUseful).length;
  const acceptedHumanDecisions = ledger.tasks.filter((task) => isAccepted(task.humanDecision)).length;
  const evalCandidates = ledger.tasks.filter((task) => task.evalCandidate).length;
  const blockers: string[] = [];

  if (ledger.tasks.length < 10) blockers.push("fewer than 10 real tasks recorded");
  if (staxCriticalMisses > 0) blockers.push("STAX critical miss recorded");
  if (meaningfulCatches < 3) blockers.push("fewer than 3 meaningful catches recorded");
  if (acceptedHumanDecisions < ledger.tasks.length) blockers.push("not every task has an accepted human decision");
  if (usefulInitialPrompts < 8) blockers.push("fewer than 8 useful initial STAX prompts recorded");
  if (evalCandidates < 1) blockers.push("no eval/patch candidates recorded from real-use misses");

  let status: RealUseCampaignSummary["status"] = "real_use_useful";
  if (ledger.tasks.length < 10 || staxCriticalMisses > 0 || meaningfulCatches < 3) {
    status = "invalid";
  } else if (usefulInitialPrompts < 8 || acceptedHumanDecisions < ledger.tasks.length) {
    status = "promotion_blocked";
  } else if (blockers.length > 0) {
    status = "real_use_candidate";
  }

  return {
    campaignId: ledger.campaignId,
    taskCount: ledger.tasks.length,
    reposRepresented: repos.size,
    staxCriticalMisses,
    meaningfulCatches,
    fakeCompleteCaught,
    missingProofCaught,
    wrongRepoPrevented,
    cleanupPromptsAfterCodex,
    usefulInitialPrompts,
    acceptedHumanDecisions,
    evalCandidates,
    status,
    blockers
  };
}

export async function validateRealUseCampaignLedger(input: {
  ledgerPath?: string;
} = {}): Promise<{ ledgerPath: string; summary: RealUseCampaignSummary }> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "dogfood_10_tasks_2026-04-30.json");
  const raw = await fs.readFile(ledgerPath, "utf8");
  const ledger = JSON.parse(raw) as RealUseCampaignLedger;
  return {
    ledgerPath,
    summary: summarizeRealUseCampaign(ledger)
  };
}
