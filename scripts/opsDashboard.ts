import { formatOperatingDashboard, validateOperatingDashboard } from "../src/campaign/OperatingDashboard.js";

async function main(): Promise<void> {
  const summary = await validateOperatingDashboard();
  process.stdout.write(`${formatOperatingDashboard(summary)}\n`);
  if (summary.status !== "ops_healthy") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
