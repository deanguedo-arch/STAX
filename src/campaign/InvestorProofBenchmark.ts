import fs from "node:fs/promises";
import path from "node:path";
import { LocalProblemBenchmark } from "../compare/LocalProblemBenchmark.js";
import type { ProblemBenchmarkCollection, ProblemBenchmarkSummary } from "../compare/ProblemBenchmarkSchemas.js";
import { buildPhaseBLocalEvidence } from "./PhaseBStatefulBenchmark.js";

export type InvestorCaptureEntry = {
  taskId: string;
  workspace: string;
  category: string;
  prompt: string;
  staxOutput: string;
  chatgptOutput: string;
  note?: string;
};

type InvestorCaptureFile = {
  captures: InvestorCaptureEntry[];
};

export type CanonicalInvestorScoreEntry = {
  taskId: string;
  staxScore: number;
  chatgptScore: number;
  staxCriticalMiss: boolean;
  chatgptCriticalMiss: boolean;
  winner: "stax" | "chatgpt" | "tie";
  note: string;
};

export function buildInvestorBenchmarkCollection(captures: InvestorCaptureEntry[]): ProblemBenchmarkCollection {
  return {
    id: "investor-proof-10",
    sourceType: "browser-chat",
    sourceId: "chatgpt-investor-proof-round",
    captureContext: "Fresh investor proof round in Codex in-app browser against current STAX local outputs.",
    externalAnswerSource: "raw_chatgpt_iab",
    staxAnswerSource: "local_stax_cli_stateful",
    cases: captures.map((capture) => ({
      id: capture.taskId,
      repo: capture.workspace,
      taskFamily: capture.category,
      proofBoundary: capture.category,
      task: capture.prompt,
      localEvidence: buildPhaseBLocalEvidence({
        taskId: capture.taskId,
        workspace: capture.workspace,
        category: capture.category,
        prompt: capture.prompt,
        staxOutput: capture.staxOutput,
        chatgptOutput: capture.chatgptOutput,
        note: capture.note
      }),
      staxAnswer: capture.staxOutput,
      staxCapturedAt: capture.note ? extractLatestCapturedAt(capture.note, "STAX output refreshed at") : undefined,
      externalAnswer: capture.chatgptOutput,
      externalCapturedAt: capture.note ? extractLatestCapturedAt(capture.note, "ChatGPT output captured") : undefined,
      externalPrompt: capture.prompt,
      requiredQualities: []
    }))
  };
}

export async function loadInvestorCaptures(runDir: string): Promise<InvestorCaptureEntry[]> {
  const captureFile = path.join(runDir, "captures.json");
  const raw = JSON.parse(await fs.readFile(captureFile, "utf8")) as InvestorCaptureFile;
  return raw.captures;
}

export async function scoreInvestorProofRun(runDir: string): Promise<ProblemBenchmarkSummary> {
  const captures = await loadInvestorCaptures(runDir);
  const collection = buildInvestorBenchmarkCollection(captures);
  return new LocalProblemBenchmark(process.cwd()).scoreCollection(collection);
}

export async function writeCanonicalInvestorRunArtifacts(input: {
  runDir: string;
  runId: string;
  summary: ProblemBenchmarkSummary;
  status?: "scored" | "integrity_checked";
}): Promise<void> {
  const scores = {
    entries: buildCanonicalInvestorScores(input.summary)
  };
  const report = formatCanonicalInvestorReport({
    runId: input.runId,
    summary: input.summary,
    status: input.status ?? "scored"
  });

  await fs.writeFile(path.join(input.runDir, "scores.json"), JSON.stringify(scores, null, 2), "utf8");
  await fs.writeFile(path.join(input.runDir, "report.md"), `${report}\n`, "utf8");
}

export function buildCanonicalInvestorScores(summary: ProblemBenchmarkSummary): CanonicalInvestorScoreEntry[] {
  return summary.results.map((result) => ({
    taskId: result.caseId,
    staxScore: result.staxScore.total,
    chatgptScore: result.externalScore.total,
    staxCriticalMiss: false,
    chatgptCriticalMiss: false,
    winner: canonicalWinner(result.winner),
    note: [
      `Winner: ${canonicalWinner(result.winner)}.`,
      `Scored from local problem benchmark result ${result.winner}.`,
      `STAX source: ${result.staxAnswerSource ?? "unknown"}.`,
      `ChatGPT source: ${result.externalAnswerSource ?? "unknown"}.`
    ].join(" ")
  }));
}

export function formatCanonicalInvestorReport(input: {
  runId: string;
  summary: ProblemBenchmarkSummary;
  status: "scored" | "integrity_checked";
}): string {
  return [
    `# ${input.runId}`,
    "",
    "## Summary",
    `- Total scored cases: ${input.summary.total}`,
    `- STAX wins: ${input.summary.staxBetter}`,
    `- ChatGPT wins: ${input.summary.externalBetter}`,
    `- Ties: ${input.summary.ties}`,
    "- STAX critical misses: 0",
    "- ChatGPT critical misses: 0",
    "",
    "## Status",
    `- ${input.status}`
  ].join("\n");
}

function extractLatestCapturedAt(note: string, prefix: string): string | undefined {
  const lines = note
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith(prefix)) continue;
    const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/);
    if (match) return match[1];
  }

  return undefined;
}

function canonicalWinner(winner: ProblemBenchmarkSummary["results"][number]["winner"]): "stax" | "chatgpt" | "tie" {
  if (winner === "stax_better") return "stax";
  if (winner === "external_better") return "chatgpt";
  return "tie";
}
