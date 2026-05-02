import fs from "node:fs/promises";
import { captureRepoTransferChatGptOutput } from "../src/repoTransfer/RepoTransferRun.js";

function parseArgs(): { runId: string; taskId: string; outputFile: string } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  const taskEq = process.argv.find((arg) => arg.startsWith("--task-id="));
  const taskIndex = process.argv.indexOf("--task-id");
  const taskId = taskEq?.slice("--task-id=".length).trim() || (taskIndex >= 0 ? process.argv[taskIndex + 1]?.trim() : undefined);
  const fileEq = process.argv.find((arg) => arg.startsWith("--file="));
  const fileIndex = process.argv.indexOf("--file");
  const outputFile = fileEq?.slice("--file=".length).trim() || (fileIndex >= 0 ? process.argv[fileIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  if (!taskId) throw new Error("Missing --task-id=<taskId>.");
  if (!outputFile) throw new Error("Missing --file=<path>.");
  return { runId, taskId, outputFile };
}

const args = parseArgs();
const output = await fs.readFile(args.outputFile, "utf8");
const result = await captureRepoTransferChatGptOutput({
  runId: args.runId,
  taskId: args.taskId,
  output
});

process.stdout.write(`${JSON.stringify({ status: "captured", runId: args.runId, taskId: args.taskId, ...result }, null, 2)}\n`);
