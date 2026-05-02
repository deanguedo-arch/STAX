import { refreshRepoTransferStaxOutputs } from "../src/repoTransfer/RepoTransferRun.js";

function parseArgs(): { runId: string; limit?: number } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  const limitEq = process.argv.find((arg) => arg.startsWith("--limit="));
  const limitIndex = process.argv.indexOf("--limit");
  const limitRaw = limitEq?.slice("--limit=".length).trim() || (limitIndex >= 0 ? process.argv[limitIndex + 1]?.trim() : undefined);
  return { runId, limit: limitRaw ? Number(limitRaw) : undefined };
}

const result = await refreshRepoTransferStaxOutputs(parseArgs());
process.stdout.write(`${JSON.stringify({ status: "refreshed", ...result }, null, 2)}\n`);
