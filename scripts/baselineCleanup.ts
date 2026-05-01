import path from "node:path";
import { validateBaselineCleanupLedger } from "../src/campaign/BaselineCleanup.js";

function parseArgs(): { ledgerPath?: string } {
  const equalsFlag = process.argv.find((arg) => arg.startsWith("--ledger="));
  if (equalsFlag) return { ledgerPath: equalsFlag.slice("--ledger=".length).trim() };
  const ledgerIndex = process.argv.indexOf("--ledger");
  const ledgerPath = ledgerIndex >= 0 ? process.argv[ledgerIndex + 1]?.trim() : undefined;
  return ledgerPath ? { ledgerPath } : {};
}

async function main(): Promise<void> {
  const result = await validateBaselineCleanupLedger(parseArgs());
  process.stdout.write(
    `${JSON.stringify(
      {
        ledgerPath: path.relative(process.cwd(), result.ledgerPath),
        ...result.summary
      },
      null,
      2
    )}\n`
  );
  if (result.summary.status === "invalid") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
