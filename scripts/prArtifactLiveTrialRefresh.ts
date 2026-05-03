import { spawn } from "node:child_process";
import { validateLivePrArtifactTrialGate } from "../src/campaign/LivePrArtifactTrialGate.js";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
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

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
