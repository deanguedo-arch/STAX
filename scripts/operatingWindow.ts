import path from "node:path";
import { validateOperatingWindow } from "../src/campaign/OperatingWindow.js";

function parseArgs(): { ledgerPath?: string; baselineLedgerPath?: string } {
  const args: { ledgerPath?: string; baselineLedgerPath?: string } = {};
  const ledgerEquals = process.argv.find((arg) => arg.startsWith("--ledger="));
  if (ledgerEquals) args.ledgerPath = ledgerEquals.slice("--ledger=".length).trim();
  const baselineEquals = process.argv.find((arg) => arg.startsWith("--baseline-ledger="));
  if (baselineEquals) args.baselineLedgerPath = baselineEquals.slice("--baseline-ledger=".length).trim();
  const ledgerIndex = process.argv.indexOf("--ledger");
  if (!args.ledgerPath && ledgerIndex >= 0) args.ledgerPath = process.argv[ledgerIndex + 1]?.trim();
  const baselineIndex = process.argv.indexOf("--baseline-ledger");
  if (!args.baselineLedgerPath && baselineIndex >= 0) args.baselineLedgerPath = process.argv[baselineIndex + 1]?.trim();
  return args;
}

async function main(): Promise<void> {
  const result = await validateOperatingWindow(parseArgs());
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
  if (result.summary.status !== "operating_window_passed") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
