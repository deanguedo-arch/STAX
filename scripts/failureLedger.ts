import path from "node:path";
import { validateFailureLedger } from "../src/campaign/FailureLedger.js";

function parseArgs(): { ledgerPath?: string; realUseLedgerPath?: string } {
  const args: { ledgerPath?: string; realUseLedgerPath?: string } = {};
  const ledgerEquals = process.argv.find((arg) => arg.startsWith("--ledger="));
  if (ledgerEquals) args.ledgerPath = ledgerEquals.slice("--ledger=".length).trim();
  const realUseEquals = process.argv.find((arg) => arg.startsWith("--real-use-ledger="));
  if (realUseEquals) args.realUseLedgerPath = realUseEquals.slice("--real-use-ledger=".length).trim();
  const ledgerIndex = process.argv.indexOf("--ledger");
  if (!args.ledgerPath && ledgerIndex >= 0) args.ledgerPath = process.argv[ledgerIndex + 1]?.trim();
  const realUseIndex = process.argv.indexOf("--real-use-ledger");
  if (!args.realUseLedgerPath && realUseIndex >= 0) args.realUseLedgerPath = process.argv[realUseIndex + 1]?.trim();
  return args;
}

async function main(): Promise<void> {
  const result = await validateFailureLedger(parseArgs());
  process.stdout.write(
    `${JSON.stringify(
      {
        ledgerPath: path.relative(process.cwd(), result.ledgerPath),
        realUseLedgerPath: path.relative(process.cwd(), result.realUseLedgerPath),
        ...result.summary
      },
      null,
      2
    )}\n`
  );
  if (result.summary.status !== "tracked") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
