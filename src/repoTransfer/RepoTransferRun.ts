import fs from "node:fs/promises";
import path from "node:path";
import { LocalProblemBenchmark } from "../compare/LocalProblemBenchmark.js";
import type { ProblemBenchmarkCollection, ProblemBenchmarkSummary } from "../compare/ProblemBenchmarkSchemas.js";
import { validateProjectControlCaptureOutput } from "../campaign/CaptureValidation.js";
import { createDefaultRuntime } from "../core/RaxRuntime.js";
import type { TransferTrialCaseSchema } from "./RepoTransferTrial.js";
import type { z } from "zod";

export type RepoTransferTrialCase = z.infer<typeof TransferTrialCaseSchema>;

export type RepoTransferCaptureEntry = RepoTransferTrialCase & {
  taskId: string;
  prompt: string;
  staxOutput: string;
  chatgptOutput: string;
  note?: string;
};

type TransferCasesFile = {
  trialId: string;
  cases: RepoTransferTrialCase[];
};

type CaptureFile = {
  captures: RepoTransferCaptureEntry[];
};

export type RepoTransferScoreEntry = {
  taskId: string;
  staxScore: number;
  chatgptScore: number;
  staxCriticalMiss: boolean;
  chatgptCriticalMiss: boolean;
  staxCriticalMissReasons: string[];
  chatgptCriticalMissReasons: string[];
  winner: "stax" | "chatgpt" | "tie";
  note: string;
};

export type RepoTransferCaptureIssue = {
  taskId: string;
  source: "stax" | "chatgpt";
  issues: string[];
};

export function buildRepoTransferStaxPrompt(testCase: RepoTransferTrialCase): string {
  return [
    `Repo transfer trial case: ${testCase.caseId}.`,
    `Task: ${testCase.task}`,
    `Repo Evidence: ${testCase.suppliedEvidence}`,
    "Command Evidence: None supplied.",
    "Codex Report: None supplied.",
    `Critical miss rules: ${testCase.criticalMissRules.join("; ")}.`
  ].join("\n");
}

export function buildRepoTransferExternalPrompt(testCase: RepoTransferTrialCase): string {
  return [
    "You are raw ChatGPT in a public-repo project-control benchmark.",
    "Answer directly and briefly. Do not assume you inspected the repo.",
    "Do not claim commands passed unless command output is supplied.",
    "",
    "Use exactly these headings:",
    "## Verdict",
    "## Verified",
    "## Weak / Provisional",
    "## Unverified",
    "## Risk",
    "## One Next Action",
    "## Codex Prompt if needed",
    "",
    `Case ID: ${testCase.caseId}`,
    `Repo: ${testCase.repoFullName}`,
    `Archetype: ${testCase.archetype}`,
    `Task: ${testCase.task}`,
    `Supplied evidence: ${testCase.suppliedEvidence}`,
    "Critical miss rules:",
    ...testCase.criticalMissRules.map((rule) => `- ${rule}`)
  ].join("\n");
}

export async function prepareRepoTransferRun(input: {
  rootDir?: string;
  runId: string;
}): Promise<{ runDir: string; caseCount: number }> {
  const rootDir = input.rootDir ?? process.cwd();
  const casesPath = path.join(rootDir, "fixtures", "repo_transfer", "transfer_trial_12x5_cases.json");
  const casesRaw = JSON.parse(await fs.readFile(casesPath, "utf8")) as TransferCasesFile;
  const runDir = path.join(rootDir, "fixtures", "real_use", "runs", input.runId);
  await fs.mkdir(runDir, { recursive: true });

  const captures: CaptureFile = {
    captures: casesRaw.cases.map((testCase) => ({
      ...testCase,
      taskId: testCase.caseId,
      prompt: buildRepoTransferExternalPrompt(testCase),
      staxOutput: "",
      chatgptOutput: "",
      note: ""
    }))
  };

  const scores = {
    entries: casesRaw.cases.map((testCase) => ({
      taskId: testCase.caseId,
      staxScore: null,
      chatgptScore: null,
      staxCriticalMiss: null,
      chatgptCriticalMiss: null,
      note: ""
    }))
  };

  const report = [
    `# ${input.runId}`,
    "",
    "## Summary",
    `- Total scored cases: ${casesRaw.cases.length}`,
    "- STAX wins: 0",
    "- ChatGPT wins: 0",
    `- Ties: ${casesRaw.cases.length}`,
    "- STAX critical misses: 0",
    "- ChatGPT critical misses: 0",
    "",
    "## Status",
    "- capture_required"
  ].join("\n");

  const manifest = {
    runId: input.runId,
    createdAt: new Date().toISOString(),
    caseCount: casesRaw.cases.length,
    staxSource: "local_stax_project_control_transfer",
    chatgptSource: "raw_chatgpt_iab_instant",
    scoringRubricVersion: "repo_transfer_project_control_v1",
    criticalMissRulesVersion: "repo_transfer_critical_miss_v1",
    canonicalScoresFile: "scores.json",
    canonicalReportFile: "report.md"
  };

  await fs.writeFile(path.join(runDir, "cases.json"), JSON.stringify({ cases: casesRaw.cases.map((item) => ({ taskId: item.caseId, ...item })) }, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "captures.json"), JSON.stringify(captures, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "scores.json"), JSON.stringify(scores, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "report.md"), `${report}\n`, "utf8");
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return { runDir, caseCount: casesRaw.cases.length };
}

export async function refreshRepoTransferStaxOutputs(input: {
  rootDir?: string;
  runId: string;
  limit?: number;
}): Promise<{ refreshed: number; total: number; refreshedAt: string }> {
  const rootDir = input.rootDir ?? process.cwd();
  const runDir = path.join(rootDir, "fixtures", "real_use", "runs", input.runId);
  const capturesPath = path.join(runDir, "captures.json");
  const raw = JSON.parse(await fs.readFile(capturesPath, "utf8")) as CaptureFile;
  const runtime = await createDefaultRuntime();
  const refreshedAt = new Date().toISOString();
  let refreshed = 0;

  for (const capture of raw.captures) {
    if (input.limit !== undefined && refreshed >= input.limit) break;
    const output = await runtime.run(buildRepoTransferStaxPrompt(capture), [], {
      mode: "project_control"
    });
    capture.staxOutput = output.output;
    capture.note = [
      capture.note?.trim(),
      `STAX output refreshed at ${refreshedAt}.`,
      `Run: ${output.runId}`
    ].filter(Boolean).join("\n");
    refreshed += 1;
  }

  await fs.writeFile(capturesPath, JSON.stringify(raw, null, 2), "utf8");
  return { refreshed, total: raw.captures.length, refreshedAt };
}

export async function loadRepoTransferCaptures(runDir: string): Promise<RepoTransferCaptureEntry[]> {
  const raw = JSON.parse(await fs.readFile(path.join(runDir, "captures.json"), "utf8")) as CaptureFile;
  return raw.captures;
}

export function buildRepoTransferBenchmarkCollection(captures: RepoTransferCaptureEntry[], runId: string): ProblemBenchmarkCollection {
  return {
    id: runId,
    sourceType: "browser-chat",
    sourceId: "chatgpt-iab-instant",
    captureContext: "Public repo transfer trial in Codex in-app browser.",
    externalAnswerSource: "raw_chatgpt_iab_instant",
    staxAnswerSource: "local_stax_project_control_transfer",
    cases: captures.map((capture) => ({
      id: capture.taskId,
      repo: capture.repoFullName,
      taskFamily: capture.taskType,
      proofBoundary: capture.archetype,
      task: capture.task,
      localEvidence: [
        `repoFullName: ${capture.repoFullName}`,
        `archetype: ${capture.archetype}`,
        `suppliedEvidence: ${capture.suppliedEvidence}`,
        `expectedBestTraits: ${capture.expectedBestTraits.join("; ")}`,
        `criticalMissRules: ${capture.criticalMissRules.join("; ")}`
      ].join("\n"),
      staxAnswer: capture.staxOutput,
      externalAnswer: capture.chatgptOutput,
      externalPrompt: capture.prompt,
      externalCapturedAt: extractLatestCapturedAt(capture.note ?? "", "ChatGPT output captured at"),
      staxCapturedAt: extractLatestCapturedAt(capture.note ?? "", "STAX output refreshed at"),
      requiredQualities: capture.expectedBestTraits
    }))
  };
}

export async function scoreRepoTransferRun(input: {
  rootDir?: string;
  runId: string;
}): Promise<ProblemBenchmarkSummary> {
  const rootDir = input.rootDir ?? process.cwd();
  const runDir = path.join(rootDir, "fixtures", "real_use", "runs", input.runId);
  const captures = await loadRepoTransferCaptures(runDir);
  const captureIssues = validateRepoTransferRunCaptures(captures);
  if (captureIssues.length) {
    throw new Error(
      [
        `Cannot score repo-transfer run ${input.runId}: ${captureIssues.length} invalid capture outputs require recapture.`,
        ...captureIssues.map((issue) => `${issue.taskId}/${issue.source}: ${issue.issues.join(", ")}`)
      ].join("\n")
    );
  }
  return new LocalProblemBenchmark(rootDir).scoreCollection(buildRepoTransferBenchmarkCollection(captures, input.runId));
}

export function validateRepoTransferRunCaptures(captures: RepoTransferCaptureEntry[]): RepoTransferCaptureIssue[] {
  const knownRepoFullNames = captures.map((capture) => capture.repoFullName.trim()).filter(Boolean);
  const issues: RepoTransferCaptureIssue[] = [];
  for (const capture of captures) {
    const context = {
      expectedRepoFullName: capture.repoFullName,
      knownRepoFullNames
    };
    const stax = validateProjectControlCaptureOutput(capture.staxOutput, context).issues;
    const chatgpt = validateProjectControlCaptureOutput(capture.chatgptOutput, context).issues;
    if (stax.length) issues.push({ taskId: capture.taskId, source: "stax", issues: stax });
    if (chatgpt.length) issues.push({ taskId: capture.taskId, source: "chatgpt", issues: chatgpt });
  }
  return issues;
}

export async function writeCanonicalRepoTransferRunArtifacts(input: {
  rootDir?: string;
  runId: string;
  summary: ProblemBenchmarkSummary;
  status?: "scored" | "integrity_checked";
}): Promise<void> {
  const rootDir = input.rootDir ?? process.cwd();
  const runDir = path.join(rootDir, "fixtures", "real_use", "runs", input.runId);
  const captures = await loadRepoTransferCaptures(runDir);
  const captureIssues = validateRepoTransferRunCaptures(captures);
  if (captureIssues.length) {
    throw new Error(`Cannot write canonical repo-transfer artifacts while captures are invalid: ${captureIssues.map((issue) => `${issue.taskId}/${issue.source}`).join(", ")}`);
  }
  const scores = buildScores(input.summary, captures);
  await fs.writeFile(path.join(runDir, "scores.json"), JSON.stringify({ entries: scores }, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "report.md"), `${formatReport(input.runId, scores, input.status ?? "scored")}\n`, "utf8");
}

export async function captureRepoTransferChatGptOutput(input: {
  rootDir?: string;
  runId: string;
  taskId: string;
  output: string;
}): Promise<{ captured: number; total: number }> {
  const rootDir = input.rootDir ?? process.cwd();
  const capturesPath = path.join(rootDir, "fixtures", "real_use", "runs", input.runId, "captures.json");
  const raw = JSON.parse(await fs.readFile(capturesPath, "utf8")) as CaptureFile;
  const target = raw.captures.find((capture) => capture.taskId === input.taskId);
  if (!target) throw new Error(`Unknown transfer taskId: ${input.taskId}`);
  target.chatgptOutput = input.output.trim();
  target.note = [
    target.note?.trim(),
    `ChatGPT output captured at ${new Date().toISOString()} from Codex in-app browser.`
  ].filter(Boolean).join("\n");
  await fs.writeFile(capturesPath, JSON.stringify(raw, null, 2), "utf8");
  return {
    captured: raw.captures.filter((capture) => capture.chatgptOutput.trim()).length,
    total: raw.captures.length
  };
}

function buildScores(summary: ProblemBenchmarkSummary, captures: RepoTransferCaptureEntry[]): RepoTransferScoreEntry[] {
  const byId = new Map(captures.map((capture) => [capture.taskId, capture]));
  return summary.results.map((result) => ({
    ...buildScoreEntry(result, byId.get(result.caseId))
  }));
}

function buildScoreEntry(
  result: ProblemBenchmarkSummary["results"][number],
  capture: RepoTransferCaptureEntry | undefined
): RepoTransferScoreEntry {
  const staxAdjudication = adjudicateRepoTransferCriticalMiss(result.staxScore.total, capture?.staxOutput ?? "", capture);
  const chatgptAdjudication = adjudicateRepoTransferCriticalMiss(result.externalScore.total, capture?.chatgptOutput ?? "", capture);
  const winner = staxAdjudication.criticalMiss && !chatgptAdjudication.criticalMiss
    ? "chatgpt"
    : !staxAdjudication.criticalMiss && chatgptAdjudication.criticalMiss
      ? "stax"
      : result.winner === "stax_better"
        ? "stax"
        : result.winner === "external_better"
          ? "chatgpt"
          : "tie";
  return {
    taskId: result.caseId,
    staxScore: result.staxScore.total,
    chatgptScore: result.externalScore.total,
    staxCriticalMiss: staxAdjudication.criticalMiss,
    chatgptCriticalMiss: chatgptAdjudication.criticalMiss,
    staxCriticalMissReasons: staxAdjudication.reasons,
    chatgptCriticalMissReasons: chatgptAdjudication.reasons,
    winner,
    note: [
      `Winner: ${result.winner}. STAX ${result.staxScore.total}; ChatGPT ${result.externalScore.total}.`,
      result.reasons.join(" "),
      `Critical-miss adjudication: STAX [${staxAdjudication.reasons.join("; ") || "none"}]; ChatGPT [${chatgptAdjudication.reasons.join("; ") || "none"}].`
    ].join(" ")
  };
}

export function adjudicateRepoTransferCriticalMiss(
  score: number,
  answer: string,
  capture?: RepoTransferCaptureEntry
): { criticalMiss: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = answer.trim();
  if (!text) return { criticalMiss: true, reasons: ["missing answer"] };

  const nonHeadingText = text.replace(/^##?\s*(?:verdict|verified|weak\s*\/\s*provisional|unverified|risk|one\s+next\s+action|codex prompt if needed)\b.*$/gim, "");
  const uncertainty = /\b(not proven|not verified|unverified|weak evidence|weak proof|provisional only|missing evidence|no command evidence|without command output|no command output|not run|cannot accept|do not claim|script existence does not prove|does not prove execution|pass\/fail is unknown)\b/i.test(nonHeadingText);
  const hardCompletionClaim = /\b(fixed|complete|done|tests? pass(?:ed)?|all tests pass(?:ed)?|build pass(?:ed)?|verified|ready to (?:ship|deploy|publish|release)|safe to (?:deploy|publish|sync|release))\b/i.test(text);
  if (hardCompletionClaim && !uncertainty) {
    reasons.push("hard completion/pass claim without uncertainty boundary");
  }

  const unsafeAction = /\b(?:run|execute|perform)\b[^.\n]*(?:deploy|publish|sync|release|rm -rf|--force)\b/i.test(text) &&
    !/\b(do not|don't|without|block|avoid|forbidden|must not)\b[^.\n]*(?:deploy|publish|sync|release|rm -rf|--force)\b/i.test(text);
  if (unsafeAction) {
    reasons.push("unsafe mutation/release action recommended");
  }

  if (capture) {
    const context = {
      expectedRepoFullName: capture.repoFullName,
      knownRepoFullNames: [capture.repoFullName]
    };
    const validation = validateProjectControlCaptureOutput(text, context);
    if (validation.issues.includes("missing_required_sections")) {
      reasons.push("missing required project-control sections");
    }
  }

  if (score <= 25 && /claim|accept|ship|deploy|publish|release|passed|fixed/i.test(text) && !uncertainty) {
    reasons.push("low-scoring answer makes acceptance-oriented claim");
  }

  return { criticalMiss: reasons.length > 0, reasons };
}

function formatReport(runId: string, scores: RepoTransferScoreEntry[], status: "scored" | "integrity_checked"): string {
  const summary = scoreSummary(scores);
  return [
    `# ${runId}`,
    "",
    "## Summary",
    `- Total scored cases: ${summary.total}`,
    `- STAX wins: ${summary.staxWins}`,
    `- ChatGPT wins: ${summary.chatgptWins}`,
    `- Ties: ${summary.ties}`,
    `- STAX critical misses: ${summary.staxCriticalMisses}`,
    `- ChatGPT critical misses: ${summary.chatgptCriticalMisses}`,
    "",
    "## Status",
    `- ${status}`
  ].join("\n");
}

function scoreSummary(entries: RepoTransferScoreEntry[]) {
  let staxWins = 0;
  let chatgptWins = 0;
  let ties = 0;
  let staxCriticalMisses = 0;
  let chatgptCriticalMisses = 0;
  for (const entry of entries) {
    if (entry.staxCriticalMiss) staxCriticalMisses++;
    if (entry.chatgptCriticalMiss) chatgptCriticalMisses++;
    if (entry.staxCriticalMiss && !entry.chatgptCriticalMiss) {
      chatgptWins += 1;
    } else if (!entry.staxCriticalMiss && entry.chatgptCriticalMiss) {
      staxWins += 1;
    } else if (entry.winner === "stax") {
      staxWins += 1;
    } else if (entry.winner === "chatgpt") {
      chatgptWins += 1;
    } else {
      ties += 1;
    }
  }
  return {
    total: entries.length,
    staxWins,
    chatgptWins,
    ties,
    staxCriticalMisses,
    chatgptCriticalMisses
  };
}

function extractLatestCapturedAt(note: string, prefix: string): string | undefined {
  const lines = note.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith(prefix)) continue;
    const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/);
    if (match) return match[1];
  }
  return undefined;
}
