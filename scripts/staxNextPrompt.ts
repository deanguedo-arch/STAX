import { getNextCodexPrompt } from "../src/sidecar/NextCodexPrompt.js";

function parseArgs(argv: string[]): { repoPath: string; copy: boolean; runGate: boolean } {
  if (argv.includes("--help") || argv.includes("-h")) throw new Error("Usage: npm run stax:next -- --repo <path> [--copy] [--no-gate]");
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repoPath = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repoPath) throw new Error("Usage: npm run stax:next-prompt -- --repo <path> [--copy] [--no-gate]");
  return {
    repoPath,
    copy: argv.includes("--copy"),
    runGate: !argv.includes("--no-gate")
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: npm run stax:next -- --repo <path> [--copy] [--no-gate]\n");
    return;
  }
  const args = parseArgs(argv);
  const result = await getNextCodexPrompt(args);
  if (!args.runGate) {
    process.stdout.write("[STAX] Using stored next prompt because --no-gate was supplied. This is not a fresh audit.\n\n");
  }
  process.stdout.write(`${result.prompt}\n`);
  if (args.copy) {
    process.stdout.write(result.copied ? "\n[STAX] Copied next Codex prompt to clipboard.\n" : `\n[STAX] Clipboard copy failed: ${result.copyError}\n`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
