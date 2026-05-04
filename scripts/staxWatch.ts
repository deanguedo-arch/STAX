import { startStaxWatcher } from "../src/sidecar/StaxWatcher.js";

function repoArg(argv: string[]): string {
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:watch -- --repo <path>");
  return repo;
}

async function main(): Promise<void> {
  const repoPath = repoArg(process.argv.slice(2));
  await startStaxWatcher({
    repoPath,
    onVerdictChange(status) {
      process.stdout.write(`[STAX] Verdict changed: ${status.verdict}\nReason: ${status.why}\nNext: ${status.oneNextAction}\n`);
    }
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
