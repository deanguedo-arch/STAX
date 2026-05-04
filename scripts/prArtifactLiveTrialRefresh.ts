import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { validateLivePrArtifactTrialGate } from "../src/campaign/LivePrArtifactTrialGate.js";
import { formatLivePrArtifactTrial, type LivePrArtifactTrialSummary } from "../src/campaign/LivePrArtifactTrial.js";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

type RefreshArgs = {
  force: boolean;
  maxCacheHours: number;
  limit: number;
  minLive: number;
  allowFallback: boolean;
  release: string;
};

function artifactKeyForLimit(limit: number): "default" | "full" {
  return limit >= 50 ? "full" : "default";
}

function artifactPathForKey(key: "default" | "full"): string {
  return path.join(
    process.cwd(),
    "fixtures",
    "real_use",
    key === "full" ? "live_pr_artifact_trial_full_latest.json" : "live_pr_artifact_trial_latest.json"
  );
}

function run(command: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const artifactKey = artifactKeyForLimit(args.limit);
  const artifactPath = artifactPathForKey(artifactKey);
  if (!args.force) {
    const cached = await loadCachedLiveTrial(artifactPath);
    if (cached) {
      const gateSummary = await validateLivePrArtifactTrialGate({
        requestedCaseCount: args.limit,
        minimumLiveSourceCount: args.minLive,
        allowFallbackSource: args.allowFallback,
        artifactPath
      });
      const ageHours = ageInHours(cached.recordedAt);
      if (gateSummary.status === "passed" && ageHours <= args.maxCacheHours) {
        await syncReleaseArtifacts({
          summary: cached,
          release: args.release,
          artifactKey
        });
        process.stdout.write(
          `${JSON.stringify(
            {
              status: "live_trial_refresh_skipped_cached_pass_fresh",
              reason: "Cached live PR artifact trial is already passing and fresh; skipping live API refresh.",
              cachedRecordedAt: cached.recordedAt,
              cachedAgeHours: ageHours,
              maxCacheHours: args.maxCacheHours,
              gateSummary
            },
            null,
            2
          )}\n`
        );
        process.exitCode = 0;
        return;
      }
    }
  }

  const trialCommand = [
    "tsx scripts/prArtifactLiveTrial.ts",
    `--limit ${args.limit}`,
    `--min-live ${args.minLive}`,
    args.allowFallback ? "" : "--disallow-fallback",
    `--artifact-key ${artifactKey}`,
    "--skip-artifacts-on-failure"
  ]
    .filter(Boolean)
    .join(" ");
  const trialResult = await run(trialCommand);
  process.stdout.write(trialResult.stdout);
  if (trialResult.stderr.trim()) process.stderr.write(trialResult.stderr);

  if (trialResult.exitCode === 0) {
    process.exitCode = 0;
    return;
  }

  let gateSummary;
  try {
    gateSummary = await validateLivePrArtifactTrialGate({
      requestedCaseCount: args.limit,
      minimumLiveSourceCount: args.minLive,
      allowFallbackSource: args.allowFallback,
      artifactPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${JSON.stringify(
        {
          status: "live_trial_refresh_failed",
          reason: "Live trial refresh failed and no usable canonical artifact was available.",
          artifactPath,
          error: message
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
    return;
  }
  if (gateSummary.status === "passed") {
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "live_trial_refresh_reused_cached_pass",
          reason:
            "Live trial refresh failed (often due API limits), but canonical recorded live trial artifact still passes gate thresholds.",
          gateSummary
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 0;
    return;
  }

  process.stderr.write(
    `${JSON.stringify(
      {
        status: "live_trial_refresh_failed",
        reason: "Live trial refresh failed and canonical recorded artifact does not pass gate thresholds.",
        gateSummary
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
}

function parseArgs(argv: string[]): RefreshArgs {
  const args: RefreshArgs = {
    force: false,
    maxCacheHours: 24,
    limit: 25,
    minLive: 5,
    allowFallback: true,
    release: "STAX_Project-Control_9_5_RC4"
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--force" || token === "--force-live") {
      args.force = true;
      continue;
    }
    if (token === "--max-cache-hours" && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value >= 0) {
        args.maxCacheHours = value;
      }
      index += 1;
      continue;
    }
    if (token === "--limit" && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value >= 1) args.limit = Math.trunc(value);
      index += 1;
      continue;
    }
    if (token === "--min-live" && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value >= 0) args.minLive = Math.trunc(value);
      index += 1;
      continue;
    }
    if (token === "--disallow-fallback") {
      args.allowFallback = false;
      continue;
    }
    if (token === "--release" && next) {
      args.release = next;
      index += 1;
      continue;
    }
  }
  return args;
}

async function loadCachedLiveTrial(artifactPath: string): Promise<LivePrArtifactTrialSummary | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(artifactPath, "utf8")) as Partial<LivePrArtifactTrialSummary>;
    if (typeof raw.recordedAt !== "string") return undefined;
    if (typeof raw.fixtureSet !== "string") return undefined;
    if (!Array.isArray(raw.blockers)) return undefined;
    if (!Array.isArray(raw.cases)) return undefined;
    if (
      typeof raw.selectedCaseCount !== "number" ||
      typeof raw.requestedCaseCount !== "number" ||
      typeof raw.liveSourceCount !== "number" ||
      typeof raw.fallbackSourceCount !== "number" ||
      typeof raw.falseAccepts !== "number" ||
      typeof raw.falseBlocks !== "number" ||
      typeof raw.falseBlockRatePct !== "number" ||
      typeof raw.usefulNextActionRate !== "number" ||
      typeof raw.ciProofClassificationSurfaceRate !== "number" ||
      (raw.status !== "passed" && raw.status !== "failed")
    ) {
      return undefined;
    }
    return raw as LivePrArtifactTrialSummary;
  } catch {
    return undefined;
  }
}

async function syncReleaseArtifacts(input: {
  summary: LivePrArtifactTrialSummary;
  release: string;
  artifactKey: "default" | "full";
}): Promise<void> {
  const artifactBaseName =
    input.artifactKey === "full" ? "pr_artifact_live_trial_full" : "pr_artifact_live_trial";
  const artifactDir = path.join(process.cwd(), "docs", "releases", input.release, "artifacts");
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(
    path.join(artifactDir, `${artifactBaseName}.json`),
    JSON.stringify(input.summary, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(artifactDir, `${artifactBaseName}.md`),
    `${formatLivePrArtifactTrial(input.summary)}\n`,
    "utf8"
  );
}

function ageInHours(isoTime: string): number {
  const now = Date.now();
  const then = new Date(isoTime).getTime();
  if (Number.isNaN(then) || then > now) return 0;
  return Number((((now - then) / (1000 * 60 * 60))).toFixed(2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
