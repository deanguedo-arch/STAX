import { runStaxGate } from "../src/sidecar/StaxGate.js";

function repoArg(argv: string[]): string {
  if (argv.includes("--help") || argv.includes("-h")) throw new Error("Usage: npm run stax:gate -- --repo <path> [--no-learning-event]");
  const index = argv.indexOf("--repo");
  const eq = argv.find((arg) => arg.startsWith("--repo="));
  const repo = eq ? eq.slice("--repo=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!repo) throw new Error("Usage: npm run stax:gate -- --repo <path> [--no-learning-event]");
  return repo;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: npm run stax:gate -- --repo <path> [--no-learning-event]\n");
    return;
  }
  const status = await runStaxGate({
    repoPath: repoArg(argv),
    writeLearningEvent: !argv.includes("--no-learning-event")
  });
  await writeStdout(status.statusMarkdown);
  process.exit(status.exitCode);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

function writeStdout(text: string): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(text, () => resolve());
  });
}
