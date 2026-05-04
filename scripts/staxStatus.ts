import { getStaxStatus } from "../src/sidecar/StaxStatus.js";

function repoArg(argv: string[]): string {
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:status -- --repo <path>");
  return repo;
}

async function main(): Promise<void> {
  process.stdout.write(await getStaxStatus(repoArg(process.argv.slice(2))));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
