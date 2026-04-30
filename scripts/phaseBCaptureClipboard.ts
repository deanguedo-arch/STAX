import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

type CaptureEntry = {
  taskId: string;
  chatgptOutput?: string;
  note?: string;
};
type Captures = { captures: CaptureEntry[] };

function parseArgs(): { run: string; taskId?: string } {
  const runFlag = process.argv.find((arg) => arg.startsWith("--run="));
  if (!runFlag) throw new Error("Missing --run=<runId>.");
  const taskFlag = process.argv.find((arg) => arg.startsWith("--task="));
  return {
    run: runFlag.slice("--run=".length).trim(),
    taskId: taskFlag?.slice("--task=".length).trim()
  };
}

function readClipboard(): string {
  return execSync("pbpaste", { encoding: "utf8" }).trim();
}

async function main(): Promise<void> {
  const { run, taskId } = parseArgs();
  const text = readClipboard();
  if (!text) throw new Error("Clipboard is empty. Copy a ChatGPT response first.");
  const check = validatePhase11CaptureIntegrity({
    campaignId: "phaseB_clipboard_probe",
    entries: [{ taskId: "clipboard", chatgptOutput: text }]
  });
  if (!check.pass) {
    throw new Error(`Clipboard capture rejected: ${check.issues[0]?.reason ?? "invalid capture text"}`);
  }

  const p = path.join(process.cwd(), "fixtures", "real_use", "runs", run, "captures.json");
  const captures = JSON.parse(await fs.readFile(p, "utf8")) as Captures;
  const target =
    (taskId
      ? captures.captures.find((entry) => entry.taskId === taskId)
      : captures.captures.find((entry) => !(entry.chatgptOutput ?? "").trim())) ?? null;
  if (!target) throw new Error("No matching task found to capture.");

  target.chatgptOutput = text;
  target.note = `Captured via browser-assisted ChatGPT subscription run (clipboard) at ${new Date().toISOString()}.`;
  await fs.writeFile(p, JSON.stringify(captures, null, 2), "utf8");

  const capturedCount = captures.captures.filter((entry) => (entry.chatgptOutput ?? "").trim()).length;
  process.stdout.write(
    `${JSON.stringify({ status: "captured", runId: run, taskId: target.taskId, capturedCount, total: captures.captures.length }, null, 2)}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
