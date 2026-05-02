import { scoreRepoTransferTrial } from "../src/repoTransfer/RepoTransferTrial.js";

async function main(): Promise<void> {
  const summary = await scoreRepoTransferTrial();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
