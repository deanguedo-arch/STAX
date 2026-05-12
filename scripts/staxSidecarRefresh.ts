import { refreshSidecar } from "../src/sidecar/SidecarRefresh.js";

type RefreshArgs = {
  repoPath: string;
  sessionsRoot?: string;
  sourceFile?: string;
};

function optionalArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: string[]): RefreshArgs {
  const repoPath = optionalArg(argv, "--repo");
  if (!repoPath) throw new Error("Usage: npm run stax:sidecar:refresh -- --repo <path> [--sessions-root <path> | --source-file <path>]");
  return {
    repoPath,
    sessionsRoot: optionalArg(argv, "--sessions-root"),
    sourceFile: optionalArg(argv, "--source-file")
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: npm run stax:sidecar:refresh -- --repo <path> [--sessions-root <path> | --source-file <path>]\n");
    return;
  }
  const result = await refreshSidecar(parseArgs(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
