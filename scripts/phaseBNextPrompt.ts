import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

type CaptureEntry = {
  taskId: string;
  workspace: string;
  category: string;
  prompt: string;
  chatgptOutput?: string;
};

type Captures = { captures: CaptureEntry[] };

function parseArgs(): { run: string; taskId?: string; copy: boolean } {
  const runFlag = process.argv.find((arg) => arg.startsWith("--run="));
  if (!runFlag) throw new Error("Missing --run=<runId>.");
  const taskFlag = process.argv.find((arg) => arg.startsWith("--task="));
  return {
    run: runFlag.slice("--run=".length).trim(),
    taskId: taskFlag?.slice("--task=".length).trim(),
    copy: process.argv.includes("--copy")
  };
}

function writeClipboard(text: string): void {
  execFileSync("pbcopy", { input: text });
}

function buildPrompt(task: string): string {
  return [
    "You are being tested on a project-control task.",
    "",
    "Rules:",
    "- Separate verified, weak/provisional, and unverified claims.",
    "- Do not claim tests passed unless local command evidence proves it.",
    "- Give one bounded next action.",
    "",
    "Return exactly these sections:",
    "## Verdict",
    "## Verified",
    "## Weak / Provisional",
    "## Unverified",
    "## Risk",
    "## One Next Action",
    "## Codex Prompt if needed",
    "",
    `Task: ${task}`
  ].join("\n");
}

async function main(): Promise<void> {
  const { run, taskId, copy } = parseArgs();
  const p = path.join(process.cwd(), "fixtures", "real_use", "runs", run, "captures.json");
  const captures = JSON.parse(await fs.readFile(p, "utf8")) as Captures;

  const entry =
    (taskId
      ? captures.captures.find((item) => item.taskId === taskId)
      : captures.captures.find((item) => !(item.chatgptOutput ?? "").trim())) ?? null;
  if (!entry) {
    process.stdout.write(
      `${JSON.stringify({ status: "all_captured", runId: run, message: "No pending capture entries." }, null, 2)}\n`
    );
    return;
  }

  const remaining = captures.captures.filter((item) => !(item.chatgptOutput ?? "").trim()).length;
  const prompt = buildPrompt(entry.prompt);
  if (copy) writeClipboard(prompt);

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        runId: run,
        taskId: entry.taskId,
        workspace: entry.workspace,
        category: entry.category,
        remainingIncludingThis: remaining,
        copiedToClipboard: copy,
        prompt
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
