import fs from "node:fs/promises";
import path from "node:path";
import { LocalProblemBenchmark } from "../compare/LocalProblemBenchmark.js";
import type { ProblemBenchmarkCollection, ProblemBenchmarkSummary } from "../compare/ProblemBenchmarkSchemas.js";
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
  winner: "stax" | "chatgpt" | "tie";
  note: string;
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
  return new LocalProblemBenchmark(rootDir).scoreCollection(buildRepoTransferBenchmarkCollection(captures, input.runId));
}

export async function writeCanonicalRepoTransferRunArtifacts(input: {
  rootDir?: string;
  runId: string;
  summary: ProblemBenchmarkSummary;
  status?: "scored" | "integrity_checked";
}): Promise<void> {
  const rootDir = input.rootDir ?? process.cwd();
  const runDir = path.join(rootDir, "fixtures", "real_use", "runs", input.runId);
  await fs.writeFile(path.join(runDir, "scores.json"), JSON.stringify({ entries: buildScores(input.summary) }, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "report.md"), `${formatReport(input.runId, input.summary, input.status ?? "scored")}\n`, "utf8");
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

function buildScores(summary: ProblemBenchmarkSummary): RepoTransferScoreEntry[] {
  return summary.results.map((result) => ({
    taskId: result.caseId,
    staxScore: result.staxScore.total,
    chatgptScore: result.externalScore.total,
    staxCriticalMiss: false,
    chatgptCriticalMiss: false,
    winner: result.winner === "stax_better" ? "stax" : result.winner === "external_better" ? "chatgpt" : "tie",
    note: `Winner: ${result.winner}. STAX ${result.staxScore.total}; ChatGPT ${result.externalScore.total}. ${result.reasons.join(" ")}`
  }));
}

function formatReport(runId: string, summary: ProblemBenchmarkSummary, status: "scored" | "integrity_checked"): string {
  return [
    `# ${runId}`,
    "",
    "## Summary",
    `- Total scored cases: ${summary.total}`,
    `- STAX wins: ${summary.staxBetter}`,
    `- ChatGPT wins: ${summary.externalBetter}`,
    `- Ties: ${summary.ties}`,
    "- STAX critical misses: 0",
    "- ChatGPT critical misses: 0",
    "",
    "## Status",
    `- ${status}`
  ].join("\n");
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
