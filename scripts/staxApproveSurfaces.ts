import { approveProofSurfaces } from "../src/projectControl/ProofSurfacePack.js";

function repoArg(argv: string[]): string {
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:approve-surfaces -- --repo <path>");
  return repo;
}

async function main(): Promise<void> {
  const result = await approveProofSurfaces(repoArg(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ...result, pack: undefined }, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
