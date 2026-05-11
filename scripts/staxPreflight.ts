import { runStaxPreflight, type StaxPreflightBoundary, type StaxPreflightMode } from "../src/sidecar/StaxPreflight.js";

function usage(): string {
  return [
    "Usage: npm run stax:preflight -- --repo <path> [--mode observer|soft|hard] [--boundary local|handoff|commit|push|merge|release|deploy|data_publish|ci]",
    "       npm run stax:preflight -- --repo <path> --mode soft --bypass-reason \"human reason\"",
    "",
    "Runs STAX gate, records a preflight event, and returns an enforcement exit code.",
    "When --mode is omitted, .stax/config.json boundary policy chooses observer, soft, or hard."
  ].join("\n");
}

function parseArgs(argv: string[]): {
  repoPath?: string;
  mode?: StaxPreflightMode;
  boundary?: StaxPreflightBoundary;
  bypassReason?: string;
  approvalPath?: string;
  actor?: string;
  command?: string[];
  help?: boolean;
} {
  const parsed: ReturnType<typeof parseArgs> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--") {
      parsed.command = argv.slice(index + 1);
      break;
    }
    if (arg === "--repo") {
      parsed.repoPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--mode") {
      parsed.mode = parseMode(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--boundary") {
      parsed.boundary = parseBoundary(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--bypass-reason") {
      parsed.bypassReason = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--approval") {
      parsed.approvalPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--actor") {
      parsed.actor = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function parseMode(value?: string): StaxPreflightMode {
  if (value === "observer" || value === "soft" || value === "hard") return value;
  throw new Error(`Invalid --mode: ${value ?? ""}`);
}

function parseBoundary(value?: string): StaxPreflightBoundary {
  if (
    value === "local" ||
    value === "handoff" ||
    value === "commit" ||
    value === "push" ||
    value === "merge" ||
    value === "release" ||
    value === "deploy" ||
    value === "data_publish" ||
    value === "ci"
  ) {
    return value;
  }
  throw new Error(`Invalid --boundary: ${value ?? ""}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.repoPath) {
    console.error(usage());
    process.exitCode = 5;
    return;
  }
  const result = await runStaxPreflight({
    repoPath: args.repoPath,
    mode: args.mode,
    boundary: args.boundary,
    bypassReason: args.bypassReason,
    approvalPath: args.approvalPath,
    actor: args.actor,
    command: args.command
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 5;
});
