import fs from "node:fs/promises";
import path from "node:path";

type CaptureEntry = {
  taskId: string;
  repoFullName: string;
  taskType: string;
};

type CaptureFile = {
  captures: CaptureEntry[];
};

function parseArgs(): { runId: string; sampleSize: number } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  const sampleEq = process.argv.find((arg) => arg.startsWith("--sample-size="));
  const sampleIndex = process.argv.indexOf("--sample-size");
  const rawSampleSize = sampleEq?.slice("--sample-size=".length).trim() || (sampleIndex >= 0 ? process.argv[sampleIndex + 1]?.trim() : "15");
  const sampleSize = Number.parseInt(rawSampleSize, 10);
  if (!Number.isFinite(sampleSize) || sampleSize < 1) throw new Error("Invalid --sample-size.");
  return { runId, sampleSize };
}

function selectEvenSample<T>(items: T[], sampleSize: number): T[] {
  if (sampleSize >= items.length) return items;
  const selected: T[] = [];
  const lastIndex = items.length - 1;
  for (let index = 0; index < sampleSize; index += 1) {
    selected.push(items[Math.round((index * lastIndex) / (sampleSize - 1))]);
  }
  return selected;
}

function formatMarkdown(input: {
  runId: string;
  generatedAt: string;
  entries: Array<{ taskId: string; repoFullName: string; taskType: string }>;
}): string {
  return [
    `# Repo Transfer Human Audit Ledger: ${input.runId}`,
    "",
    "## Status",
    "- pending_recapture",
    "",
    "## Purpose",
    "- This ledger is a preselected human-audit sample. It does not claim any row has been reviewed yet.",
    "- Fill it only after fresh ChatGPT captures exist and hygiene/integrity gates pass.",
    "",
    "## Required Checks",
    "- Correct prompt",
    "- Correct repo",
    "- No UI contamination",
    "- No prompt echo",
    "- One answer only",
    "- Score reasonable",
    "",
    "## Sample",
    ...input.entries.map((entry) => `- ${entry.taskId} (${entry.repoFullName}, ${entry.taskType})`)
  ].join("\n");
}

const { runId, sampleSize } = parseArgs();
const runDir = path.join(process.cwd(), "fixtures", "real_use", "runs", runId);
const captures = JSON.parse(await fs.readFile(path.join(runDir, "captures.json"), "utf8")) as CaptureFile;
const generatedAt = new Date().toISOString();
const sample = selectEvenSample(captures.captures, sampleSize);
const payload = {
  status: "pending_recapture",
  runId,
  generatedAt,
  sampleSize: sample.length,
  requiredChecks: [
    "correct_prompt",
    "correct_repo",
    "no_ui_contamination",
    "no_prompt_echo",
    "one_answer_only",
    "score_reasonable"
  ],
  entries: sample.map((entry) => ({
    taskId: entry.taskId,
    repoFullName: entry.repoFullName,
    taskType: entry.taskType,
    status: "pending_recapture",
    reviewer: null,
    reviewedAt: null,
    checks: {
      correctPrompt: null,
      correctRepo: null,
      noUiContamination: null,
      noPromptEcho: null,
      oneAnswerOnly: null,
      scoreReasonable: null
    },
    notes: ""
  }))
};

await fs.writeFile(path.join(runDir, "human_audit_ledger.json"), JSON.stringify(payload, null, 2), "utf8");
await fs.writeFile(
  path.join(runDir, "human_audit_ledger.md"),
  `${formatMarkdown({ runId, generatedAt, entries: sample })}\n`,
  "utf8"
);

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
