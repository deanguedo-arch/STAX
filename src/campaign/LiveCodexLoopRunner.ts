import fs from "node:fs/promises";
import path from "node:path";
import { createDefaultRuntime, type RaxRuntime } from "../core/RaxRuntime.js";
import {
  stringifyProjectControlEvidencePacket,
  type StructuredProjectControlEvidencePacket,
  type ProjectControlChangedFile,
  type ProjectControlCommandEvidenceEntry
} from "../projectControl/ProjectControlEvidencePacket.js";
import { classifyFileRole } from "../diffAudit/DiffAudit.js";
import type {
  ClosedLoopCodexLedger,
  ClosedLoopCodexTask,
  ClosedLoopFinalOutcome,
  ClosedLoopTaskState
} from "./ClosedLoopCodexCampaign.js";
import { sectionContent } from "../validators/markdownSections.js";

export async function initializeLiveCodexLoopTask(args: {
  ledgerPath: string;
  taskId: string;
  repo: string;
  objective: string;
  packet: StructuredProjectControlEvidencePacket;
  runtime?: RaxRuntime;
}): Promise<{ ledger: ClosedLoopCodexLedger; task: ClosedLoopCodexTask }> {
  const runtime = args.runtime ?? (await createDefaultRuntime());
  const input = stringifyProjectControlEvidencePacket(args.packet);
  const output = await runtime.run(input, [], {
    mode: "project_control",
    linkedRepoPath: args.packet.targetRepoPath
  });

  const task: ClosedLoopCodexTask = {
    taskId: args.taskId,
    repo: args.repo,
    state: "prompt_generated",
    stateHistory: [
      { state: "created", note: "task recorded from live project-control packet" },
      { state: "scoped", note: "repo and objective scoped from packet" },
      { state: "prompt_generated", note: "initial STAX audit and Codex prompt generated" }
    ],
    objective: args.objective,
    staxInitialAudit: output.output,
    staxCodexPrompt: sectionContent(output.output, "## Codex Prompt if needed").trim(),
    codexReport: "",
    diffEvidence: "",
    commandEvidence: "",
    staxPostCodexAudit: "",
    nextAction: extractOneNextAction(output.output),
    cleanupPromptsAfterCodex: 0,
    finalOutcome: "bounded_stop",
    falseAccept: false,
    falseBlock: false,
    usefulBlock: false,
    verifiedAccept: false,
    staxInitialPromptUseful: true,
    evalCandidate: false
  };

  const ledger = await loadOrCreateLedger(args.ledgerPath);
  ledger.tasks.push(task);
  await fs.writeFile(args.ledgerPath, JSON.stringify(ledger, null, 2));
  return { ledger, task };
}

export async function recordLiveCodexLoopTurn(args: {
  ledgerPath: string;
  taskId: string;
  codexReport: string;
  diffEvidence: string;
  commandEvidence: string;
  repoEvidence?: string;
  packet?: StructuredProjectControlEvidencePacket;
  runtime?: RaxRuntime;
}): Promise<{ ledger: ClosedLoopCodexLedger; task: ClosedLoopCodexTask }> {
  const ledger = await loadOrCreateLedger(args.ledgerPath);
  const task = ledger.tasks.find((entry) => entry.taskId === args.taskId);
  if (!task) throw new Error(`Unknown live Codex loop task: ${args.taskId}`);

  const runtime = args.runtime ?? (await createDefaultRuntime());
  const packet = buildRecordedTurnPacket({
    base: args.packet ?? {
      task: task.objective,
      repo: task.repo,
      targetRepoPath: `/workspace/${task.repo}`,
      changedFiles: [],
      commandEvidence: [],
      codexReport: "",
      visualEvidence: [],
      dataProofArtifacts: [],
      releaseProofArtifacts: [],
      humanApproval: []
    },
    codexReport: args.codexReport,
    diffEvidence: args.diffEvidence,
    commandEvidence: args.commandEvidence
  });
  const input = stringifyProjectControlEvidencePacket(packet);

  const output = await runtime.run(input, [], {
    mode: "project_control",
    linkedRepoPath: packet.targetRepoPath
  });

  task.codexReport = args.codexReport;
  task.diffEvidence = args.diffEvidence;
  task.commandEvidence = args.commandEvidence;
  task.staxPostCodexAudit = output.output;
  task.nextAction = extractOneNextAction(output.output);
  task.stateHistory = [
    ...task.stateHistory,
    { state: "codex_report_received", note: "Codex report captured" },
    ...(args.diffEvidence.trim() ? [{ state: "diff_collected" as const, note: "diff evidence captured" }] : []),
    ...(args.commandEvidence.trim()
      ? [{ state: "command_evidence_collected" as const, note: "command evidence captured" }]
      : []),
    { state: "audited", note: "post-Codex audit generated" }
  ];

  const outcome = deriveFinalOutcome(output.output, Boolean(args.diffEvidence.trim()), Boolean(args.commandEvidence.trim()));
  task.finalOutcome = outcome;
  task.state = mapOutcomeToState(outcome);
  task.stateHistory.push({ state: task.state, note: "final outcome recorded from project-control audit" });
  task.verifiedAccept = outcome === "verified_complete" || outcome === "verified_next_state";
  task.usefulBlock = outcome === "blocked_pending_evidence" || outcome === "rejected_fake_complete";
  task.falseAccept = false;
  task.falseBlock = false;
  task.evalCandidate = outcome === "rejected_fake_complete";
  if (task.evalCandidate) {
    task.failurePatterns = task.failurePatterns?.length ? task.failurePatterns : ["A1_CLAIMED_COMMAND_PASSED_NO_EVIDENCE"];
    task.evalCandidates = task.evalCandidates?.length ? task.evalCandidates : [`eval_${task.taskId}_fake_complete`];
  }

  await fs.writeFile(args.ledgerPath, JSON.stringify(ledger, null, 2));
  return { ledger, task };
}

function buildRecordedTurnPacket(args: {
  base: StructuredProjectControlEvidencePacket;
  codexReport: string;
  diffEvidence: string;
  commandEvidence: string;
}): StructuredProjectControlEvidencePacket {
  return {
    ...args.base,
    codexReport: args.codexReport,
    changedFiles: args.base.changedFiles.length > 0 ? args.base.changedFiles : parseChangedFiles(args.diffEvidence),
    commandEvidence: args.base.commandEvidence.length > 0
      ? args.base.commandEvidence
      : parseCommandEvidence(args.commandEvidence),
    unifiedDiff: args.base.unifiedDiff
  };
}

function parseChangedFiles(diffEvidence: string): ProjectControlChangedFile[] {
  const lines = diffEvidence
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const payload = lines
    .flatMap((line) =>
      line.replace(/^changed files:\s*/i, "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .filter((line) => /[/.]/.test(line));
  return Array.from(new Set(payload)).map((file) => ({
    path: file,
    changeType: "modified",
    fileRole: classifyFileRole(file)
  }));
}

function parseCommandEvidence(commandEvidence: string): ProjectControlCommandEvidenceEntry[] {
  const cwd = commandEvidence.match(/cwd=([^\n]+)/i)?.[1]?.trim();
  const command = commandEvidence.match(/\$\s*([^\n]+)/)?.[1]?.trim();
  const exitCodeRaw = commandEvidence.match(/exit code:\s*(-?\d+)/i)?.[1];
  if (!command) return [];
  return [{
    command,
    cwd,
    exitCode: exitCodeRaw !== undefined ? Number(exitCodeRaw) : undefined,
    stdout: commandEvidence,
    stderr: "",
    source: "local_stax_command_output"
  }];
}

async function loadOrCreateLedger(ledgerPath: string): Promise<ClosedLoopCodexLedger> {
  try {
    return JSON.parse(await fs.readFile(ledgerPath, "utf8")) as ClosedLoopCodexLedger;
  } catch {
    await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
    return {
      campaignId: "live_codex_loop_runner",
      purpose: "Live project-control workflow ledger",
      tasks: []
    };
  }
}

function extractOneNextAction(output: string): string | undefined {
  const nextAction = sectionContent(output, "## One Next Action").trim();
  return nextAction.replace(/^[-*]\s*/, "").trim() || undefined;
}

function deriveFinalOutcome(output: string, hasDiff: boolean, hasCommandEvidence: boolean): ClosedLoopFinalOutcome {
  const verdict = sectionContent(output, "## Verdict").toLowerCase();
  if (verdict.includes("clean failure")) return "clean_failure";
  if (verdict.includes("human review")) return "human_review_required";
  if (verdict.includes("reject") && /\bfake-complete\b/i.test(output)) return "rejected_fake_complete";
  if (verdict.includes("reject") || verdict.includes("provisional") || verdict.includes("not proven")) {
    return "blocked_pending_evidence";
  }
  if (verdict.includes("accept") || verdict.includes("validated") || verdict.includes("proven")) {
    if (hasDiff && hasCommandEvidence) return "verified_complete";
    return "verified_next_state";
  }
  return "bounded_stop";
}

function mapOutcomeToState(outcome: ClosedLoopFinalOutcome): ClosedLoopTaskState {
  switch (outcome) {
    case "verified_complete":
      return "verified_complete";
    case "verified_next_state":
      return "verified_next_state";
    case "clean_failure":
      return "clean_failure";
    case "blocked_pending_evidence":
      return "blocked_pending_evidence";
    case "rejected_fake_complete":
      return "rejected_fake_complete";
    case "human_review_required":
      return "human_review_required";
    case "bounded_stop":
      return "audited";
  }
}
