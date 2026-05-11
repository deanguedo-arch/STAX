import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { upgradeStaxSidecar } from "../src/sidecar/UpgradeSidecar.js";

function repoArg(argv: string[]): string {
  if (argv.includes("--help") || argv.includes("-h")) throw new Error("Usage: npm run stax:attach -- --repo <path> [--upgrade]");
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:attach -- --repo <path>");
  return repo;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: npm run stax:attach -- --repo <path> [--upgrade]\n");
    return;
  }
  const result = argv.includes("--upgrade") ? await upgradeStaxSidecar({ repoPath: repoArg(argv) }) : await attachStaxToRepo(repoArg(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
