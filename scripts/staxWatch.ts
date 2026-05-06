import { startStaxWatcher } from "../src/sidecar/StaxWatcher.js";

function parseArgs(argv: string[]): { repoPath: string; sessionsRoot?: string; sourceFile?: string } {
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:watch -- --repo <path>");
  const sessionsIndex = argv.indexOf("--sessions-root");
  const sessionsEq = argv.find((arg) => arg.startsWith("--sessions-root="));
  const sourceIndex = argv.indexOf("--source-file");
  const sourceEq = argv.find((arg) => arg.startsWith("--source-file="));
  return {
    repoPath: repo,
    sessionsRoot: sessionsEq ? sessionsEq.slice("--sessions-root=".length) : sessionsIndex >= 0 ? argv[sessionsIndex + 1] : undefined,
    sourceFile: sourceEq ? sourceEq.slice("--source-file=".length) : sourceIndex >= 0 ? argv[sourceIndex + 1] : undefined
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await startStaxWatcher({
    repoPath: args.repoPath,
    sessionsRoot: args.sessionsRoot,
    sourceFile: args.sourceFile,
    onVerdictChange(status) {
      process.stdout.write(`[STAX] Verdict changed: ${status.verdict}\nReason: ${status.why}\nNext: ${status.oneNextAction}\n`);
      if (status.turnContract?.requiredAcknowledgement) {
        process.stdout.write(`[STAX] Required acknowledgement: ${status.turnContract.requiredAcknowledgement}\n`);
      }
    }
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
