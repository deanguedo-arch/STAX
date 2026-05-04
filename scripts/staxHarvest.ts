import { harvestSidecarEvents } from "../src/learning/SidecarHarvest.js";

function fromArg(argv: string[]): string {
  const index = argv.indexOf("--from");
  const eq = argv.find((arg) => arg.startsWith("--from="));
  const from = eq ? eq.slice("--from=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!from) throw new Error("Usage: npm run stax:harvest -- --from <project-repo>");
  return from;
}

async function main(): Promise<void> {
  const result = await harvestSidecarEvents({ fromRepoPath: fromArg(process.argv.slice(2)) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
