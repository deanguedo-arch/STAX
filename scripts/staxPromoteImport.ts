import { promoteSidecarImport } from "../src/learning/SidecarImportPromotion.js";

function parseArgs(argv: string[]): { candidateId: string; approve: boolean; allowSingleEvent: boolean } {
  const index = argv.indexOf("--candidate");
  const eq = argv.find((arg) => arg.startsWith("--candidate="));
  const candidateId = eq ? eq.slice("--candidate=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!candidateId) throw new Error("Usage: npm run stax:promote-import -- --candidate <id> --approve");
  return {
    candidateId,
    approve: argv.includes("--approve"),
    allowSingleEvent: argv.includes("--allow-single-event")
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await promoteSidecarImport(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
