import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

const execFileAsync = promisify(execFile);

function cliInvocation(args: string[]): { command: string; commandArgs: string[] } {
  const repoRoot = process.cwd();
  const tsxBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const cliPath = path.join(repoRoot, "src", "cli.ts");
  return {
    command: process.platform === "win32" ? "cmd.exe" : tsxBin,
    commandArgs: process.platform === "win32" ? ["/c", tsxBin, cliPath, ...args] : [cliPath, ...args]
  };
}

describe("STAX proof-gate CLI", () => {
  it("exposes proof-gate help instead of routing STAX commands into runtime chat", async () => {
    const cli = cliInvocation(["gate", "--help"]);

    const { stdout } = await execFileAsync(cli.command, cli.commandArgs);

    expect(stdout).toContain("Usage: stax gate --repo <path>");
    expect(stdout).toContain(".stax/status.md");
  }, 30000);

  it("attaches, prints status, prints next prompt, and collects command evidence through stax subcommands", async () => {
    const repoPath = await createTempGitRepo("stax-cli-proof-gate-");

    const attach = cliInvocation(["attach", "--repo", repoPath]);
    const attachResult = await execFileAsync(attach.command, attach.commandArgs);
    const attached = JSON.parse(attachResult.stdout) as { repoPath: string; sidecarPath: string };
    expect(attached.repoPath).toBe(repoPath);
    expect(attached.sidecarPath).toBe(path.join(repoPath, ".stax"));

    const status = cliInvocation(["status", "--repo", repoPath]);
    const statusResult = await execFileAsync(status.command, status.commandArgs);
    expect(statusResult.stdout).toContain("## Verdict");

    const next = cliInvocation(["next", "--repo", repoPath, "--no-gate"]);
    const nextResult = await execFileAsync(next.command, next.commandArgs);
    expect(nextResult.stdout).toContain(".stax/codex-report.md");

    const collect = cliInvocation(["collect", "--repo", repoPath, "--", process.execPath, "-e", "console.log('proof')"]);
    const collectResult = await execFileAsync(collect.command, collect.commandArgs);
    const evidence = JSON.parse(collectResult.stdout) as { command: string; cwd: string; exitCode: number };
    expect(evidence.cwd).toBe(repoPath);
    expect(evidence.exitCode).toBe(0);
    expect(evidence.command).toContain("console.log('proof')");
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence"))).resolves.toBeTruthy();
  }, 30000);
});
