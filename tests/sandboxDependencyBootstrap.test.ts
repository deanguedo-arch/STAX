import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { SandboxDependencyBootstrap } from "../src/verification/SandboxDependencyBootstrap.js";
import { SandboxGuard } from "../src/verification/SandboxGuard.js";
import type { SandboxCommandRunner } from "../src/verification/SandboxCommandWindow.js";
import { WorkPacketPlanner } from "../src/verification/WorkPacketPlanner.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-sandbox-bootstrap-"));
}

async function fixtureRepo(rootDir: string): Promise<string> {
  const repo = path.join(rootDir, "linked-brightspace");
  await fs.mkdir(path.join(repo, "tmp"), { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "node -e \"console.log('build ok')\"" } }), "utf8");
  await fs.writeFile(path.join(repo, "package-lock.json"), "{\"lockfileVersion\":3}\n", "utf8");
  await fs.writeFile(path.join(repo, "tmp", ".gitkeep"), "", "utf8");
  return repo;
}

function packet(repoPath: string) {
  return new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
    workspace: "brightspacequizexporter",
    repoPath
  });
}

async function createSandbox(rootDir: string): Promise<{ sourceRepoPath: string; sandboxPath: string }> {
  const sourceRepoPath = await fixtureRepo(rootDir);
  const sandboxPath = path.join(rootDir, "sandbox");
  await new SandboxGuard().create({
    workspace: "brightspacequizexporter",
    packetId: "repair_rollup_install_integrity",
    sourceRepoPath,
    sandboxPath,
    humanApprovedSandbox: true
  });
  return { sourceRepoPath, sandboxPath };
}

describe("SandboxDependencyBootstrap", () => {
  it("requires approval before bootstrapping dependencies", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new SandboxDependencyBootstrap(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      execute: true
    });

    expect(result.status).toBe("approval_required");
    expect(calls).toBe(0);
  });

  it("blocks commands outside the bootstrap allowlist", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    const runner: SandboxCommandRunner = async () => ({ exitCode: 0, stdout: "", stderr: "" });

    const result = await new SandboxDependencyBootstrap(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedBootstrap: true,
      execute: true,
      commands: ["npm audit fix"]
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("hard-blocked");
  });

  it("runs npm ci when node_modules is missing and records command evidence", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    const runner: SandboxCommandRunner = async ({ command, cwd }) => {
      if (command === "npm ci") await fs.mkdir(path.join(cwd, "node_modules", ".bin"), { recursive: true });
      return { exitCode: 0, stdout: `${command} ok`, stderr: "" };
    };

    const result = await new SandboxDependencyBootstrap(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedBootstrap: true,
      execute: true
    });
    const evidence = await new CommandEvidenceStore(rootDir).list({ workspace: "brightspacequizexporter" });

    expect(result.status).toBe("bootstrapped");
    expect(result.commandsRun).toEqual(["npm ci", "npm ls @rollup/rollup-darwin-arm64 rollup vite"]);
    expect(evidence.map((item) => item.command)).toEqual(result.commandsRun);
    await expect(new SandboxGuard().verify({
      workspace: "brightspacequizexporter",
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath
    })).resolves.toMatchObject({ allowedForCommandWindow: true });
  });

  it("refreshes the manifest after package-lock repair changes", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    await fs.mkdir(path.join(sandboxPath, "node_modules"), { recursive: true });
    const runner: SandboxCommandRunner = async ({ command, cwd }) => {
      if (command === "npm install --package-lock-only") {
        await fs.writeFile(path.join(cwd, "package-lock.json"), "{\"lockfileVersion\":3,\"repaired\":true}\n", "utf8");
      }
      return { exitCode: 0, stdout: `${command} ok`, stderr: "" };
    };

    const result = await new SandboxDependencyBootstrap(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedBootstrap: true,
      execute: true,
      repairLockfile: true
    });

    expect(result.status).toBe("bootstrapped");
    expect(result.changedFiles).toEqual(["package-lock.json"]);
    expect(result.manifestRefreshed).toBe(true);
    expect(await fs.readFile(path.join(sourceRepoPath, "package-lock.json"), "utf8")).toBe("{\"lockfileVersion\":3}\n");
  });

  it("stops on first bootstrap command failure", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    const runner: SandboxCommandRunner = async ({ command }) => ({
      exitCode: command === "npm ci" ? 1 : 0,
      stdout: "",
      stderr: command === "npm ci" ? "install failed" : ""
    });

    const result = await new SandboxDependencyBootstrap(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedBootstrap: true,
      execute: true
    });

    expect(result.status).toBe("stopped");
    expect(result.commandsRun).toEqual(["npm ci"]);
    expect(result.firstRemainingFailure).toContain("npm ci failed");
  });
});
