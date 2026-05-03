import path from "node:path";
import {
  formatHumanJudgmentDigest,
  validateHumanJudgmentLedger
} from "../src/campaign/HumanJudgmentConsole.js";

function parseArgs(): { ledgerPath?: string; closedLoopLedgerPath?: string } {
  const args: { ledgerPath?: string; closedLoopLedgerPath?: string } = {};
  const mapping = [
    ["--ledger=", "ledgerPath"],
    ["--closed-loop-ledger=", "closedLoopLedgerPath"]
  ] as const;
  for (const [prefix, key] of mapping) {
    const hit = process.argv.find((arg) => arg.startsWith(prefix));
    if (hit) args[key] = hit.slice(prefix.length).trim();
  }
  const positional = [
    ["--ledger", "ledgerPath"],
    ["--closed-loop-ledger", "closedLoopLedgerPath"]
  ] as const;
  for (const [flag, key] of positional) {
    if (args[key]) continue;
    const index = process.argv.indexOf(flag);
    if (index >= 0) args[key] = process.argv[index + 1]?.trim();
  }
  return args;
}

async function main(): Promise<void> {
  const result = await validateHumanJudgmentLedger(parseArgs());
  process.stdout.write(
    `${JSON.stringify(
      {
        ledgerPath: path.relative(process.cwd(), result.ledgerPath),
        closedLoopLedgerPath: path.relative(process.cwd(), result.closedLoopLedgerPath),
        ...result.summary,
        digest: formatHumanJudgmentDigest(result.summary)
      },
      null,
      2
    )}\n`
  );
  if (result.summary.status !== "judgment_ready") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
