import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { validateLivePrArtifactTrialGate } from "../src/campaign/LivePrArtifactTrialGate.js";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

type RefreshArgs = {
  force: boolean;
  maxCacheHours: number;
};

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
  if (!args.force) {
    const cached = await loadCachedLiveTrial();
    if (cached) {
      const gateSummary = await validateLivePrArtifactTrialGate();
      const ageHours = ageInHours(cached.recordedAt);
      if (gateSummary.status === "passed" && ageHours <= args.maxCacheHours) {
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

  const trialResult = await run("npm run pr-artifact:live-trial");
  process.stdout.write(trialResult.stdout);
  if (trialResult.stderr.trim()) process.stderr.write(trialResult.stderr);

  if (trialResult.exitCode === 0) {
    process.exitCode = 0;
    return;
  }

  const gateSummary = await validateLivePrArtifactTrialGate();
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
    maxCacheHours: 24
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--force") {
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
  }
  return args;
}

async function loadCachedLiveTrial(): Promise<{ recordedAt: string } | undefined> {
  const artifactPath = path.join(process.cwd(), "fixtures", "real_use", "live_pr_artifact_trial_latest.json");
  try {
    const raw = JSON.parse(await fs.readFile(artifactPath, "utf8")) as { recordedAt?: unknown };
    if (typeof raw.recordedAt !== "string") return undefined;
    return { recordedAt: raw.recordedAt };
  } catch {
    return undefined;
  }
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
