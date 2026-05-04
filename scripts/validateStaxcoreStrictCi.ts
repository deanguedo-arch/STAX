import { spawn } from "node:child_process";

type CliArgs = {
  attempts: number;
  delayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  command: string;
};

function run(command: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      shell: true,
      stdio: "inherit"
    });
    child.on("close", (exitCode) => {
      resolve(exitCode ?? 1);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    attempts: 3,
    delayMs: 5000,
    maxDelayMs: 30000,
    backoffFactor: 2,
    command: "npm run validate:staxcore:strict"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--attempts" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 1) args.attempts = Math.trunc(parsed);
      index += 1;
      continue;
    }
    if (token === "--delay-ms" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) args.delayMs = Math.trunc(parsed);
      index += 1;
      continue;
    }
    if (token === "--max-delay-ms" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) args.maxDelayMs = Math.trunc(parsed);
      index += 1;
      continue;
    }
    if (token === "--backoff-factor" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 1) args.backoffFactor = parsed;
      index += 1;
      continue;
    }
    if (token === "--command" && next) {
      args.command = next;
      index += 1;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let lastExitCode = 1;
  let retryDelayMs = args.delayMs;

  for (let attempt = 1; attempt <= args.attempts; attempt += 1) {
    process.stdout.write(
      `[staxcore-strict-ci] attempt ${attempt}/${args.attempts}: ${args.command}\n`
    );

    lastExitCode = await run(args.command);
    if (lastExitCode === 0) {
      process.stdout.write(
        `[staxcore-strict-ci] strict release gate passed on attempt ${attempt}.\n`
      );
      process.exitCode = 0;
      return;
    }

    if (attempt < args.attempts) {
      process.stderr.write(
        `[staxcore-strict-ci] strict gate failed on attempt ${attempt} (exit ${lastExitCode}); retrying in ${retryDelayMs}ms.\n`
      );
      await sleep(retryDelayMs);
      retryDelayMs = Math.min(
        args.maxDelayMs,
        Math.max(args.delayMs, Math.trunc(retryDelayMs * args.backoffFactor))
      );
    }
  }

  process.stderr.write(
    `[staxcore-strict-ci] strict release gate failed after ${args.attempts} attempt(s).\n`
  );
  process.exitCode = lastExitCode;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
