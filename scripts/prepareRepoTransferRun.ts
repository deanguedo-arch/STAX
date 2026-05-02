import path from "node:path";
import { prepareRepoTransferRun } from "../src/repoTransfer/RepoTransferRun.js";

function parseArgs(): { runId: string } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  return { runId: runId || `repo-transfer-12x5-${new Date().toISOString().slice(0, 10)}` };
}

const { runId } = parseArgs();
const result = await prepareRepoTransferRun({ runId });

process.stdout.write(
  `${JSON.stringify(
    {
      status: "prepared",
      runId,
      runDir: path.relative(process.cwd(), result.runDir),
      caseCount: result.caseCount
    },
    null,
    2
  )}\n`
);
