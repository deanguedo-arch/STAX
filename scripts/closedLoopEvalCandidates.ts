import path from "node:path";
import { loadClosedLoopLedger, writeClosedLoopEvalCandidates } from "../src/campaign/ClosedLoopEvalGenerator.js";

function parseArgs(): { ledgerPath?: string } {
  const args: { ledgerPath?: string } = {};
  const inline = process.argv.find((arg) => arg.startsWith("--ledger="));
  if (inline) args.ledgerPath = inline.slice("--ledger=".length).trim();
  const index = process.argv.indexOf("--ledger");
  if (!args.ledgerPath && index >= 0) args.ledgerPath = process.argv[index + 1]?.trim();
  return args;
}

async function main(): Promise<void> {
  const parsed = parseArgs();
  const ledger = await loadClosedLoopLedger(process.cwd(), parsed.ledgerPath);
  const result = await writeClosedLoopEvalCandidates({ ledger, rootDir: process.cwd() });
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir: path.relative(process.cwd(), result.outputDir),
        manifestPath: path.relative(process.cwd(), result.manifestPath),
        ...result.summary
      },
      null,
      2
    )}\n`
  );
  if (!result.summary.coverageValid) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
