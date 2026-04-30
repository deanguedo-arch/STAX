import path from "node:path";
import { validateComparisonRunIntegrity } from "../src/campaign/ComparisonIntegrity.js";

function parseArgs(): { runId?: string } {
  const runFlag = process.argv.find((arg) => arg.startsWith("--run="));
  if (!runFlag) return {};
  const runId = runFlag.slice("--run=".length).trim();
  return runId ? { runId } : {};
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.runId) {
    throw new Error("Missing --run=<runId> argument.");
  }

  const result = await validateComparisonRunIntegrity({
    runId: args.runId
  });

  const payload = {
    status: result.pass ? "passed" : "failed",
    runId: result.runId,
    runDir: path.relative(process.cwd(), result.runDir),
    summary: result.summary,
    issues: result.issues
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!result.pass) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
