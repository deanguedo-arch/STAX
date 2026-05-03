import fs from "node:fs/promises";
import path from "node:path";
import {
  formatLivePrArtifactTrial,
  runLivePrArtifactTrial
} from "../src/campaign/LivePrArtifactTrial.js";

type CliArgs = {
  limit?: number;
  minLive?: number;
  allowFallback: boolean;
  release: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runLivePrArtifactTrial({
    requestedCaseCount: args.limit,
    minimumLiveSourceCount: args.minLive,
    allowFallbackSource: args.allowFallback
  });

  const artifactsDir = path.join(
    process.cwd(),
    "docs",
    "releases",
    args.release,
    "artifacts"
  );
  const fixtureSummaryPath = path.join(
    process.cwd(),
    "fixtures",
    "real_use",
    "live_pr_artifact_trial_latest.json"
  );
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.mkdir(path.dirname(fixtureSummaryPath), { recursive: true });
  await fs.writeFile(
    path.join(artifactsDir, "pr_artifact_live_trial.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(artifactsDir, "pr_artifact_live_trial.md"),
    `${formatLivePrArtifactTrial(summary)}\n`,
    "utf8"
  );
  await fs.writeFile(fixtureSummaryPath, JSON.stringify(summary, null, 2), "utf8");

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "passed") process.exitCode = 1;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    allowFallback: true,
    release: "STAX_Project-Control_9_5_RC4"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--limit" && next) {
      args.limit = Number(next);
      index += 1;
      continue;
    }
    if (token === "--min-live" && next) {
      args.minLive = Number(next);
      index += 1;
      continue;
    }
    if (token === "--release" && next) {
      args.release = next;
      index += 1;
      continue;
    }
    if (token === "--disallow-fallback") {
      args.allowFallback = false;
      continue;
    }
  }

  return args;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
