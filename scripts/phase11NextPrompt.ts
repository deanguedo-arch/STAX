import fs from "node:fs/promises";
import path from "node:path";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

type CaptureEntry = {
  taskId: string;
  workspace: string;
  category: string;
  prompt: string;
  chatgptOutput: string | null;
};

type CaptureFile = {
  campaignId: string;
  entries: CaptureEntry[];
};

const CAPTURE_PATH = path.join(
  process.cwd(),
  "fixtures",
  "real_use",
  "phase11_subscription_capture.json"
);

function parseArgs(): { taskId?: string } {
  const taskFlag = process.argv.find((arg) => arg.startsWith("--task="));
  if (!taskFlag) return {};
  const value = taskFlag.slice("--task=".length).trim();
  return value ? { taskId: value } : {};
}

function buildPrompt(taskPrompt: string): string {
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
    `Task: ${taskPrompt}`
  ].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs();
  const raw = await fs.readFile(CAPTURE_PATH, "utf8");
  const capture = JSON.parse(raw) as CaptureFile;
  const integrity = validatePhase11CaptureIntegrity({
    campaignId: capture.campaignId,
    entries: capture.entries.map((item) => ({
      taskId: item.taskId,
      chatgptOutput: item.chatgptOutput
    }))
  });
  const firstInvalidTaskId = integrity.issues[0]?.taskId ?? null;

  const entry =
    (args.taskId
      ? capture.entries.find((item) => item.taskId === args.taskId)
      : capture.entries.find((item) => item.taskId === firstInvalidTaskId) ??
        capture.entries.find((item) => !item.chatgptOutput?.trim())) ?? null;

  if (!entry) {
    process.stdout.write(
      JSON.stringify(
        {
          status: "all_captured",
          message: "All task outputs are already captured in phase11_subscription_capture.json."
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  const remaining = capture.entries.filter((item) => !item.chatgptOutput?.trim()).length;
  const selectedIssue = integrity.issues.find((issue) => issue.taskId === entry.taskId)?.reason ?? null;

  process.stdout.write(
    JSON.stringify(
      {
        status: "ok",
        taskId: entry.taskId,
        workspace: entry.workspace,
        category: entry.category,
        remainingIncludingThis: remaining,
        captureIssue: selectedIssue,
        prompt: buildPrompt(entry.prompt)
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
