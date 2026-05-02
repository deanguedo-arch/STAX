import fs from "node:fs/promises";
import path from "node:path";

type CaptureFile = {
  captures: Array<{
    taskId: string;
    repoFullName: string;
    taskType: string;
    prompt: string;
    chatgptOutput: string;
  }>;
};

function parseArgs(): { runId: string; taskId?: string } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  const taskEq = process.argv.find((arg) => arg.startsWith("--task-id="));
  const taskIndex = process.argv.indexOf("--task-id");
  const taskId = taskEq?.slice("--task-id=".length).trim() || (taskIndex >= 0 ? process.argv[taskIndex + 1]?.trim() : undefined);
  return { runId, taskId };
}

const { runId, taskId } = parseArgs();
const capturesPath = path.join(process.cwd(), "fixtures", "real_use", "runs", runId, "captures.json");
const captureFile = JSON.parse(await fs.readFile(capturesPath, "utf8")) as CaptureFile;
const selected =
  (taskId
    ? captureFile.captures.find((capture) => capture.taskId === taskId)
    : captureFile.captures.find((capture) => !capture.chatgptOutput.trim())) ?? null;

if (!selected) {
  process.stdout.write(`${JSON.stringify({ status: "all_captured", runId }, null, 2)}\n`);
} else {
  process.stdout.write(
    [
      `Run: ${runId}`,
      `Task: ${selected.taskId}`,
      `Repo: ${selected.repoFullName}`,
      `TaskType: ${selected.taskType}`,
      "",
      selected.prompt,
      ""
    ].join("\n")
  );
}
