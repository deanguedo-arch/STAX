import { collectCommandEvidence } from "../src/sidecar/CommandEvidenceCollector.js";

function parseArgs(argv: string[]): { repoPath: string; command: string[]; allowRisky: boolean } {
  const repoIndex = argv.indexOf("--repo");
  const repoEq = argv.find((arg) => arg.startsWith("--repo="));
  const repoPath = repoEq ? repoEq.slice("--repo=".length) : repoIndex >= 0 ? argv[repoIndex + 1] : undefined;
  if (!repoPath) throw new Error("Usage: npm run stax:collect -- --repo <path> -- <command...>");
  const allowRisky = argv.includes("--allow-risky");
  const separator = argv.indexOf("--");
  const command = separator >= 0 ? argv.slice(separator + 1) : [];
  if (command.length === 0) throw new Error("No command supplied after --.");
  return { repoPath, command, allowRisky };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const evidence = await collectCommandEvidence(args);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  process.exitCode = evidence.exitCode ?? 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
