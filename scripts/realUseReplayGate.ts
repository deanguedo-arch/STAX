import { runRealUseReplayGate } from "../src/campaign/RealUseReplayGate.js";

async function main(): Promise<void> {
  const result = await runRealUseReplayGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
