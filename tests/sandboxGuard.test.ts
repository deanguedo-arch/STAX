import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { SandboxGuard } from "../src/verification/SandboxGuard.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

const execFileAsync = promisify(execFile);

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-sandbox-guard-"));
}

async function fixtureRepo(rootDir: string): Promise<string> {
  const repo = path.join(rootDir, "linked-brightspace");
  await fs.mkdir(path.join(repo, "src"), { recursive: true });
  await fs.mkdir(path.join(repo, "node_modules", "left-pad"), { recursive: true });
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "vite build" } }), "utf8");
  await fs.writeFile(path.join(repo, "package-lock.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(repo, "src", "index.ts"), "export const ok = true;\n", "utf8");
  await fs.writeFile(path.join(repo, ".env"), "SECRET=yes\n", "utf8");
  await fs.writeFile(path.join(repo, ".npmrc"), "//registry.npmjs.org/:_authToken=secret\n", "utf8");
  await fs.writeFile(path.join(repo, "private.pem"), "secret\n", "utf8");
  await fs.writeFile(path.join(repo, "node_modules", "left-pad", "index.js"), "module.exports = '';\n", "utf8");
  await fs.writeFile(path.join(repo, ".git", "HEAD"), "ref: main\n", "utf8");
  await fs.symlink(path.join(repo, "package.json"), path.join(repo, "package-link.json"));
  return repo;
}

function cliInvocation(args: string[]): { command: string; commandArgs: string[] } {
  const repoRoot = process.cwd();
  const tsxBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const cliPath = path.join(repoRoot, "src", "cli.ts");
  return {
    command: process.platform === "win32" ? "cmd.exe" : tsxBin,
    commandArgs: process.platform === "win32" ? ["/c", tsxBin, cliPath, ...args] : [cliPath, ...args]
  };
}

describe("SandboxGuard", () => {
  it("requires approval before creating a sandbox", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");

    const result = await new SandboxGuard().create({ sourceRepoPath, sandboxPath });

    expect(result.status).toBe("approval_required");
    await expect(fs.stat(sandboxPath)).rejects.toThrow();
  });

  it("creates a sandbox copy with a manifest and skips unsafe/heavy entries", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");

    const result = await new SandboxGuard().create({
      workspace: "brightspacequizexporter",
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });

    expect(result.status).toBe("created");
    expect(result.allowedForCommandWindow).toBe(true);
    expect(await fs.readFile(path.join(sandboxPath, "package.json"), "utf8")).toContain("build");
    await expect(fs.stat(path.join(sandboxPath, "node_modules"))).rejects.toThrow();
    await expect(fs.stat(path.join(sandboxPath, ".git"))).rejects.toThrow();
    await expect(fs.stat(path.join(sandboxPath, ".env"))).rejects.toThrow();
    await expect(fs.stat(path.join(sandboxPath, ".npmrc"))).rejects.toThrow();
    await expect(fs.stat(path.join(sandboxPath, "private.pem"))).rejects.toThrow();
    await expect(fs.stat(path.join(sandboxPath, "package-link.json"))).rejects.toThrow();
    expect(result.skippedEntries).toEqual(expect.arrayContaining(["node_modules", ".git", ".env", ".npmrc", "private.pem", "package-link.json"]));
  });

  it("verifies a sandbox manifest before command windows use it", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });

    const verified = await new SandboxGuard().verify({
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath
    });

    expect(verified.status).toBe("verified");
    expect(verified.allowedForCommandWindow).toBe(true);
  });

  it("blocks sandbox paths that equal or live inside the linked repo", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const same = await new SandboxGuard().create({
      sourceRepoPath,
      sandboxPath: sourceRepoPath,
      humanApprovedSandbox: true
    });
    const inside = await new SandboxGuard().create({
      sourceRepoPath,
      sandboxPath: path.join(sourceRepoPath, ".stax-sandbox"),
      humanApprovedSandbox: true
    });

    expect(same.status).toBe("blocked");
    expect(same.blockingReasons[0]).toContain("cannot equal");
    expect(inside.status).toBe("blocked");
    expect(inside.blockingReasons[0]).toContain("inside the linked repo");
  });

  it("does not overwrite a non-empty target without a STAX sandbox manifest", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "occupied");
    await fs.mkdir(sandboxPath, { recursive: true });
    await fs.writeFile(path.join(sandboxPath, "keep.txt"), "do not overwrite\n", "utf8");

    const result = await new SandboxGuard().create({
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("already exists");
  });

  it("does not merge-copy into an existing STAX sandbox manifest", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });

    const result = await new SandboxGuard().create({
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("already has a STAX manifest");
  });

  it("exposes sandbox create/verify through the CLI", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: sourceRepoPath, use: true });
    const createCli = cliInvocation([
      "auto-advance",
      "sandbox",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--sandbox-path",
      sandboxPath,
      "--approve",
      "--create"
    ]);
    const verifyCli = cliInvocation([
      "auto-advance",
      "sandbox",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--sandbox-path",
      sandboxPath,
      "--verify"
    ]);

    const created = JSON.parse((await execFileAsync(createCli.command, createCli.commandArgs, { cwd: rootDir })).stdout) as { status: string };
    const verified = JSON.parse((await execFileAsync(verifyCli.command, verifyCli.commandArgs, { cwd: rootDir })).stdout) as { status: string };

    expect(created.status).toBe("created");
    expect(verified.status).toBe("verified");
  }, 30000);

  it("blocks CLI command-window execution without sandbox proof", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox-without-manifest");
    await fs.mkdir(sandboxPath, { recursive: true });
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: sourceRepoPath, use: true });
    const invocation = cliInvocation([
      "auto-advance",
      "command-window",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--approve",
      "--execute",
      "--sandbox-path",
      sandboxPath,
      "--command",
      "npm run build",
      "--completed-ls"
    ]);

    await expect(execFileAsync(invocation.command, invocation.commandArgs, { cwd: rootDir })).rejects.toMatchObject({ code: 1 });
  }, 30000);
});
