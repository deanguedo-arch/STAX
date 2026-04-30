import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

type CaptureEntry = {
  taskId: string;
  chatgptOutput: string | null;
  note: string;
};

type CaptureFile = {
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

function readClipboard(): string {
  return execSync("pbpaste", { encoding: "utf8" }).trim();
}

async function main(): Promise<void> {
  const args = parseArgs();
  const text = readClipboard();
  if (!text) {
    throw new Error("Clipboard is empty. Copy a ChatGPT response first.");
  }
  const clipboardCheck = validatePhase11CaptureIntegrity({
    campaignId: "phase11_clipboard_probe",
    entries: [{ taskId: "clipboard", chatgptOutput: text }]
  });
  if (!clipboardCheck.pass) {
    const reason = clipboardCheck.issues[0]?.reason ?? "Clipboard text failed capture integrity.";
    throw new Error(`Clipboard capture rejected: ${reason}`);
  }

  const raw = await fs.readFile(CAPTURE_PATH, "utf8");
  const capture = JSON.parse(raw) as CaptureFile;
  const target =
    (args.taskId
      ? capture.entries.find((entry) => entry.taskId === args.taskId)
      : capture.entries.find((entry) => !entry.chatgptOutput?.trim())) ?? null;

  if (!target) {
    throw new Error("No matching task found to capture.");
  }

  target.chatgptOutput = text;
  target.note = `Captured via browser-assisted ChatGPT subscription run (clipboard) at ${new Date().toISOString()}.`;

  await fs.writeFile(CAPTURE_PATH, JSON.stringify(capture, null, 2), "utf8");

  const capturedCount = capture.entries.filter((entry) => entry.chatgptOutput?.trim()).length;
  const summary = {
    status: "captured",
    taskId: target.taskId,
    capturedCount,
    total: capture.entries.length
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
