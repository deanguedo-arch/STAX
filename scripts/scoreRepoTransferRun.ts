import {
  scoreRepoTransferRun,
  writeCanonicalRepoTransferRunArtifacts
} from "../src/repoTransfer/RepoTransferRun.js";

function parseArgs(): { runId: string; write: boolean } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  return { runId, write: process.argv.includes("--write") };
}

const { runId, write } = parseArgs();
const summary = await scoreRepoTransferRun({ runId });
if (write) {
  await writeCanonicalRepoTransferRunArtifacts({ runId, summary });
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: write ? "scored_and_written" : "scored",
      runId,
      total: summary.total,
      staxWins: summary.staxBetter,
      chatgptWins: summary.externalBetter,
      ties: summary.ties,
      noLocalBasis: summary.noLocalBasis,
      noExternalBaseline: summary.noExternalBaseline,
      confidence: summary.confidence,
      superiorityStatus: summary.superiorityStatus
    },
    null,
    2
  )}\n`
);
