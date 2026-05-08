import { harvestSidecarEvents } from "../src/learning/SidecarHarvest.js";
import os from "node:os";
import path from "node:path";

function argValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  return eq ? eq.slice(`${name}=`.length) : index >= 0 ? argv[index + 1] : undefined;
}

function fromArg(argv: string[]): string {
  const index = argv.indexOf("--from");
  const eq = argv.find((arg) => arg.startsWith("--from="));
  const from = eq ? eq.slice("--from=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (!from) {
    throw new Error("Usage: npm run stax:harvest -- --from <project-repo> [--sessions-root <path>] [--no-session-logs]");
  }
  return from;
}

function defaultSessionsRoot(): string {
  return process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, "sessions") : path.join(os.homedir(), ".codex", "sessions");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const result = await harvestSidecarEvents({
    fromRepoPath: fromArg(argv),
    sessionsRoot: argv.includes("--no-session-logs") ? undefined : argValue(argv, "--sessions-root") ?? defaultSessionsRoot()
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
