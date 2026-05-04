import { collectCodexTurn } from "../src/sidecar/CodexTurnCapture.js";

function parseArgs(argv: string[]): { repoPath: string; sessionsRoot?: string; sourceFile?: string } {
  const repoIndex = argv.indexOf("--repo");
  const repoEq = argv.find((arg) => arg.startsWith("--repo="));
  const repoPath = repoEq ? repoEq.slice("--repo=".length) : repoIndex >= 0 ? argv[repoIndex + 1] : undefined;
  if (!repoPath) {
    throw new Error("Usage: npm run stax:codex-collect -- --repo <path> [--sessions-root <path>] [--source-file <path>]");
  }

  const sessionsIndex = argv.indexOf("--sessions-root");
  const sessionsEq = argv.find((arg) => arg.startsWith("--sessions-root="));
  const sourceIndex = argv.indexOf("--source-file");
  const sourceEq = argv.find((arg) => arg.startsWith("--source-file="));
  return {
    repoPath,
    sessionsRoot: sessionsEq ? sessionsEq.slice("--sessions-root=".length) : sessionsIndex >= 0 ? argv[sessionsIndex + 1] : undefined,
    sourceFile: sourceEq ? sourceEq.slice("--source-file=".length) : sourceIndex >= 0 ? argv[sourceIndex + 1] : undefined
  };
}

async function main(): Promise<void> {
  const result = await collectCodexTurn(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
