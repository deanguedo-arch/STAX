import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];

function cliInvocation(args: string[]): { command: string; commandArgs: string[] } {
  const repoRoot = process.cwd();
  const tsxBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const cliPath = path.join(repoRoot, "src", "cli.ts");
  return {
    command: process.platform === "win32" ? "cmd.exe" : tsxBin,
    commandArgs: process.platform === "win32" ? ["/c", tsxBin, cliPath, ...args] : [cliPath, ...args]
  };
}

async function tempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "staxcore-release-cli-"));
  tempDirs.push(root);
  return root;
}

function parseJsonOutput(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  return JSON.parse(trimmed) as Record<string, unknown>;
}

async function runCli(command: string, commandArgs: string[], cwd: string): Promise<{ stdout: string; exitCode: number }> {
  try {
    const { stdout } = await execFileAsync(command, commandArgs, { cwd });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const cause = error as { stdout?: string; code?: number | string };
    return {
      stdout: cause.stdout ?? "",
      exitCode: typeof cause.code === "number" ? cause.code : 1
    };
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("staxcore release-gate CLI strict profile", () => {
  it("blocks strict dry-run when eval checks are missing", async () => {
    const root = await tempRoot();
    const cli = cliInvocation([
      "staxcore",
      "release-gate",
      "--strict",
      "--dry-run",
      "--typecheck-pass",
      "--tests-pass",
      "--doctrine-pass",
      "--boundaries-pass",
      "--security-pass",
      "--replay-pass",
      "--replay-deterministic",
      "--replay-chain-valid",
      "--print",
      "json"
    ]);

    const result = await runCli(cli.command, cli.commandArgs, root);
    expect(result.exitCode).toBe(1);
    const { stdout } = result;
    const payload = parseJsonOutput(stdout);
    const releaseGate = payload.releaseGate as { canRelease: boolean; failedChecks: string[]; profile: string };

    expect(releaseGate.profile).toBe("strict");
    expect(releaseGate.canRelease).toBe(false);
    expect(releaseGate.failedChecks).toEqual(expect.arrayContaining(["eval", "regressionEval", "redteamEval"]));
  }, 30000);

  it("passes strict dry-run when eval checks are provided", async () => {
    const root = await tempRoot();
    const cli = cliInvocation([
      "staxcore",
      "release-gate",
      "--strict",
      "--dry-run",
      "--typecheck-pass",
      "--tests-pass",
      "--eval-pass",
      "--eval-regression-pass",
      "--eval-redteam-pass",
      "--doctrine-pass",
      "--boundaries-pass",
      "--security-pass",
      "--replay-pass",
      "--replay-deterministic",
      "--replay-chain-valid",
      "--print",
      "json"
    ]);

    const result = await runCli(cli.command, cli.commandArgs, root);
    expect(result.exitCode).toBe(0);
    const { stdout } = result;
    const payload = parseJsonOutput(stdout);
    const releaseGate = payload.releaseGate as { canRelease: boolean; failedChecks: string[]; profile: string };

    expect(releaseGate.profile).toBe("strict");
    expect(releaseGate.canRelease).toBe(true);
    expect(releaseGate.failedChecks).toEqual([]);
  }, 30000);

  it("keeps standard dry-run passable without eval flags", async () => {
    const root = await tempRoot();
    const cli = cliInvocation([
      "staxcore",
      "release-gate",
      "--dry-run",
      "--typecheck-pass",
      "--tests-pass",
      "--doctrine-pass",
      "--boundaries-pass",
      "--security-pass",
      "--replay-pass",
      "--replay-deterministic",
      "--replay-chain-valid",
      "--print",
      "json"
    ]);

    const result = await runCli(cli.command, cli.commandArgs, root);
    expect(result.exitCode).toBe(0);
    const { stdout } = result;
    const payload = parseJsonOutput(stdout);
    const releaseGate = payload.releaseGate as { canRelease: boolean; failedChecks: string[]; profile: string };

    expect(releaseGate.profile).toBe("standard");
    expect(releaseGate.canRelease).toBe(true);
    expect(releaseGate.failedChecks).toEqual([]);
  }, 30000);
});
