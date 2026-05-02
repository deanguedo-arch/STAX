import path from "node:path";
import { validateClosedLoopCodexCampaign } from "../src/campaign/ClosedLoopCodexCampaign.js";

function parseArgs(): { ledgerPath?: string; baselineLedgerPath?: string } {
  const args: { ledgerPath?: string; baselineLedgerPath?: string } = {};
  const mapping = [
    ["--ledger=", "ledgerPath"],
    ["--baseline-ledger=", "baselineLedgerPath"]
  ] as const;
  for (const [prefix, key] of mapping) {
    const hit = process.argv.find((arg) => arg.startsWith(prefix));
    if (hit) args[key] = hit.slice(prefix.length).trim();
  }
  const positional = [
    ["--ledger", "ledgerPath"],
    ["--baseline-ledger", "baselineLedgerPath"]
  ] as const;
  for (const [flag, key] of positional) {
    if (args[key]) continue;
    const index = process.argv.indexOf(flag);
    if (index >= 0) args[key] = process.argv[index + 1]?.trim();
  }
  return args;
}

async function main(): Promise<void> {
  const result = await validateClosedLoopCodexCampaign(parseArgs());
  process.stdout.write(
    `${JSON.stringify(
      {
        ledgerPath: path.relative(process.cwd(), result.ledgerPath),
        baselineLedgerPath: path.relative(process.cwd(), result.baselineLedgerPath),
        ...result.summary
      },
      null,
      2
    )}\n`
  );
  if (result.summary.status !== "closed_loop_passed") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
