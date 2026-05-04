import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";

function repoArg(argv: string[]): string {
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:attach -- --repo <path>");
  return repo;
}

async function main(): Promise<void> {
  const result = await attachStaxToRepo(repoArg(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
