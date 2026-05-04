import { scorePrArtifactTrial } from "../src/campaign/PrArtifactTrial.js";

function parseFixturePath(argv: string[]): string | undefined {
  const eqArg = argv.find((arg) => arg.startsWith("--fixture="));
  if (eqArg) return eqArg.slice("--fixture=".length).trim() || undefined;
  const index = argv.indexOf("--fixture");
  if (index >= 0) return argv[index + 1]?.trim() || undefined;
  return undefined;
}

async function main(): Promise<void> {
  const fixturePath = parseFixturePath(process.argv.slice(2));
  const summary = await scorePrArtifactTrial(process.cwd(), { fixturePath });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
