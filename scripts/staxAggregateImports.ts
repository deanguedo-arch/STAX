import { writeSidecarImportAggregationReport } from "../src/learning/SidecarImportAggregation.js";

async function main(): Promise<void> {
  const result = await writeSidecarImportAggregationReport(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
