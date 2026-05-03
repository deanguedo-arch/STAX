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
  skipArtifactsOnFailure: boolean;
  artifactKey: "default" | "full";
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
    args.artifactKey === "full"
      ? "live_pr_artifact_trial_full_latest.json"
      : "live_pr_artifact_trial_latest.json"
  );
  const failedAttemptPath = path.join(
    process.cwd(),
    "fixtures",
    "real_use",
    args.artifactKey === "full"
      ? "live_pr_artifact_trial_full_last_attempt_failed.json"
      : "live_pr_artifact_trial_last_attempt_failed.json"
  );
  const releaseArtifactBaseName =
    args.artifactKey === "full" ? "pr_artifact_live_trial_full" : "pr_artifact_live_trial";
  const shouldWriteReleaseArtifacts = summary.status === "passed" || !args.skipArtifactsOnFailure;
  if (shouldWriteReleaseArtifacts) {
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.writeFile(
      path.join(artifactsDir, `${releaseArtifactBaseName}.json`),
      JSON.stringify(summary, null, 2),
      "utf8"
    );
    await fs.writeFile(
      path.join(artifactsDir, `${releaseArtifactBaseName}.md`),
      `${formatLivePrArtifactTrial(summary)}\n`,
      "utf8"
    );
  }
  await fs.mkdir(path.dirname(fixtureSummaryPath), { recursive: true });
  if (summary.status === "passed") {
    await fs.writeFile(fixtureSummaryPath, JSON.stringify(summary, null, 2), "utf8");
    await fs.rm(failedAttemptPath, { force: true });
  } else {
    await fs.writeFile(failedAttemptPath, JSON.stringify(summary, null, 2), "utf8");
    process.stderr.write(
      `Live PR trial did not pass; keeping existing ${path.basename(fixtureSummaryPath)} unchanged.\n`
    );
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "passed") process.exitCode = 1;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    allowFallback: true,
    release: "STAX_Project-Control_9_5_RC4",
    skipArtifactsOnFailure: false,
    artifactKey: "default"
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
    if (token === "--skip-artifacts-on-failure") {
      args.skipArtifactsOnFailure = true;
      continue;
    }
    if (token === "--artifact-key" && next && (next === "default" || next === "full")) {
      args.artifactKey = next;
      index += 1;
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
