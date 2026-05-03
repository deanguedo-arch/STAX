import fs from "node:fs/promises";
import path from "node:path";
import { analyzeProjectControlCodexPrompt } from "../projectControl/CodexPromptQuality.js";
import { analyzeCodexReportContract } from "../projectControl/CodexReportContract.js";
import type { ClosedLoopCodexLedger, ClosedLoopCodexTask } from "./ClosedLoopCodexCampaign.js";

export type LiveCodexWorkflowTaskSummary = {
  taskId: string;
  promptStatus: "strong" | "partial" | "weak";
  reportStatus: "absent" | "well_formed" | "partial" | "malformed";
  nextActionPresent: boolean;
  verifiedOutcome: boolean;
  issues: string[];
};

export type LiveCodexWorkflowContractSummary = {
  campaignId: string;
  taskCount: number;
  promptStrongCount: number;
  promptUsableCount: number;
  promptUsableRate: number;
  reportWellFormedCount: number;
  reportUsableCount: number;
  reportUsableRate: number;
  nextActionCoverage: number;
  verifiedOutcomeReportCoverage: number;
  falseAccepts: number;
  falseBlocks: number;
  taskSummaries: LiveCodexWorkflowTaskSummary[];
  status: "workflow_contract_passed" | "workflow_contract_blocked" | "invalid";
  blockers: string[];
};

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function needsRiskGuardrails(task: ClosedLoopCodexTask): boolean {
  const combined = [task.objective, task.codexReport, task.staxCodexPrompt].join("\n");
  return /\b(publish|sync|deploy|release|security|memory|rollback|sheets)\b/i.test(combined);
}

function isVerifiedOutcome(task: ClosedLoopCodexTask): boolean {
  return task.finalOutcome === "verified_next_state" || task.finalOutcome === "verified_complete";
}

function summarizeTask(task: ClosedLoopCodexTask): LiveCodexWorkflowTaskSummary {
  const prompt = analyzeProjectControlCodexPrompt({
    prompt: task.staxCodexPrompt,
    requiresRiskGuardrails: needsRiskGuardrails(task)
  });
  const report = analyzeCodexReportContract(task.codexReport);
  const nextActionPresent = Boolean(task.nextAction?.trim());
  const verifiedOutcome = isVerifiedOutcome(task);
  const issues: string[] = [];

  if (prompt.status === "weak") {
    issues.push(`weak prompt: ${prompt.issues[0] ?? "prompt is not safely bounded"}`);
  }
  if (!nextActionPresent) {
    issues.push("missing one next action");
  }
  if (verifiedOutcome && (report.status === "absent" || report.status === "malformed")) {
    issues.push("verified outcome is backed by an absent or malformed Codex report");
  }
  if ((report.status === "partial" || report.status === "malformed") && report.issues[0]) {
    issues.push(`report contract: ${report.issues[0]}`);
  }

  return {
    taskId: task.taskId,
    promptStatus: prompt.status,
    reportStatus: report.status,
    nextActionPresent,
    verifiedOutcome,
    issues
  };
}

export function summarizeLiveCodexWorkflowContract(args: {
  ledger: ClosedLoopCodexLedger;
}): LiveCodexWorkflowContractSummary {
  const taskSummaries = args.ledger.tasks.map(summarizeTask);
  const promptStrongCount = taskSummaries.filter((task) => task.promptStatus === "strong").length;
  const promptUsableCount = taskSummaries.filter((task) => task.promptStatus !== "weak").length;
  const reportWellFormedCount = taskSummaries.filter((task) => task.reportStatus === "well_formed").length;
  const reportUsableCount = taskSummaries.filter((task) => task.reportStatus === "well_formed" || task.reportStatus === "partial").length;
  const nextActionCoverage = pct(taskSummaries.filter((task) => task.nextActionPresent).length, taskSummaries.length);
  const verifiedTasks = taskSummaries.filter((task) => task.verifiedOutcome);
  const verifiedOutcomeReportCoverage = pct(
    verifiedTasks.filter((task) => task.reportStatus === "well_formed" || task.reportStatus === "partial").length,
    verifiedTasks.length
  );
  const falseAccepts = args.ledger.tasks.filter((task) => task.falseAccept).length;
  const falseBlocks = args.ledger.tasks.filter((task) => task.falseBlock).length;

  const blockers: string[] = [];
  if (args.ledger.tasks.length < 10) blockers.push("fewer than 10 live Codex workflow tasks recorded");
  if (promptUsableCount !== args.ledger.tasks.length) blockers.push("at least one live Codex workflow prompt is weak");
  if (pct(promptUsableCount, args.ledger.tasks.length) < 90) blockers.push("prompt usable rate is below 90 percent");
  if (pct(reportUsableCount, args.ledger.tasks.length) < 85) blockers.push("report contract usable rate is below 85 percent");
  if (nextActionCoverage < 100) blockers.push("not every live Codex workflow task has exactly one next action recorded");
  if (verifiedOutcomeReportCoverage < 100) blockers.push("verified workflow outcomes are missing usable Codex report contracts");
  if (falseAccepts > 0) blockers.push("false accepts recorded in live Codex workflow tasks");
  if (pct(falseBlocks, args.ledger.tasks.length) > 15) blockers.push("false-block rate is above 15 percent in live Codex workflow tasks");

  const status: LiveCodexWorkflowContractSummary["status"] =
    args.ledger.tasks.length === 0
      ? "invalid"
      : blockers.length > 0
        ? "workflow_contract_blocked"
        : "workflow_contract_passed";

  return {
    campaignId: args.ledger.campaignId,
    taskCount: args.ledger.tasks.length,
    promptStrongCount,
    promptUsableCount,
    promptUsableRate: pct(promptUsableCount, args.ledger.tasks.length),
    reportWellFormedCount,
    reportUsableCount,
    reportUsableRate: pct(reportUsableCount, args.ledger.tasks.length),
    nextActionCoverage,
    verifiedOutcomeReportCoverage,
    falseAccepts,
    falseBlocks,
    taskSummaries,
    status,
    blockers
  };
}

export async function validateLiveCodexWorkflowContract(input: {
  ledgerPath?: string;
} = {}): Promise<LiveCodexWorkflowContractSummary> {
  const ledgerPath =
    input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "live_codex_workflow_10_tasks.json");
  const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as ClosedLoopCodexLedger;
  return summarizeLiveCodexWorkflowContract({ ledger });
}
