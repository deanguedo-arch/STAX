import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { SandboxCommandWindow, type SandboxCommandRunner } from "../src/verification/SandboxCommandWindow.js";
import { WorkPacketPlanner } from "../src/verification/WorkPacketPlanner.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-sandbox-command-window-"));
}

describe("SandboxCommandWindow", () => {
  const packet = new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
    workspace: "brightspacequizexporter",
    repoPath: "/Users/deanguedo/Documents/GitHub/brightspacequizexporter"
  });

  it("does not run commands without approval", async () => {
    const rootDir = await tempRoot();
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run build"],
      sandboxPath: path.join(rootDir, "sandbox"),
      execute: true
    });

    expect(result.status).toBe("approval_required");
    expect(result.commandsRun).toHaveLength(0);
    expect(calls).toBe(0);
  });

  it("permits only exact allowlisted commands inside an approved window", async () => {
    const rootDir = await tempRoot();
    const sandboxPath = path.join(rootDir, "sandbox");
    await fs.mkdir(sandboxPath, { recursive: true });
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "ok", stderr: "" };
    };

    const allowed = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run build"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath,
      completedCommands: [{ command: "npm ls @rollup/rollup-darwin-arm64 rollup vite", exitCode: 0 }]
    });
    const blocked = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm test"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath
    });

    expect(allowed.commandsRun).toEqual(["npm run build"]);
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockingReasons[0]).toContain("not allowlisted");
    expect(calls).toBe(1);
  });

  it("hard-stops hard-blocked commands", async () => {
    const rootDir = await tempRoot();
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run ingest:seed-gold"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath: path.join(rootDir, "sandbox")
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("hard-blocked");
    expect(calls).toBe(0);
  });

  it("records command evidence with cwd, command, exit code, and summary", async () => {
    const rootDir = await tempRoot();
    const sandboxPath = path.join(rootDir, "sandbox");
    await fs.mkdir(sandboxPath, { recursive: true });
    const runner: SandboxCommandRunner = async ({ command, cwd }) => ({
      exitCode: 0,
      stdout: `${command} ok in ${cwd}`,
      stderr: ""
    });

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm ls @rollup/rollup-darwin-arm64 rollup vite"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath,
      workspace: "brightspacequizexporter",
      linkedRepoPath: "/Users/deanguedo/Documents/GitHub/brightspacequizexporter"
    });
    const evidence = await new CommandEvidenceStore(rootDir).list({
      workspace: "brightspacequizexporter",
      command: "npm ls @rollup/rollup-darwin-arm64 rollup vite"
    });

    expect(result.status).toBe("command_recorded");
    expect(result.evidenceIds).toHaveLength(1);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.cwd).toBe(sandboxPath);
    expect(evidence[0]?.exitCode).toBe(0);
    expect(evidence[0]?.summary).toContain("cwd=");
  });

  it("stops on failed command and reports first remaining failure", async () => {
    const rootDir = await tempRoot();
    const sandboxPath = path.join(rootDir, "sandbox");
    await fs.mkdir(sandboxPath, { recursive: true });
    const runner: SandboxCommandRunner = async ({ command }) => ({
      exitCode: command === "npm run build" ? 1 : 0,
      stdout: "",
      stderr: "build failed"
    });

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run build", "npm run ingest:ci"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath,
      completedCommands: [{ command: "npm ls @rollup/rollup-darwin-arm64 rollup vite", exitCode: 0 }]
    });

    expect(result.status).toBe("stopped");
    expect(result.commandsRun).toEqual(["npm run build"]);
    expect(result.firstRemainingFailure).toContain("npm run build failed");
  });

  it("requires npm run build to pass before npm run ingest:ci", async () => {
    const rootDir = await tempRoot();
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run ingest:ci"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath: path.join(rootDir, "sandbox")
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("npm run build must pass");
    expect(calls).toBe(0);
  });

  it("completes after build and ingest:ci pass", async () => {
    const rootDir = await tempRoot();
    const sandboxPath = path.join(rootDir, "sandbox");
    await fs.mkdir(sandboxPath, { recursive: true });
    const runner: SandboxCommandRunner = async () => ({ exitCode: 0, stdout: "passed", stderr: "" });

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run build", "npm run ingest:ci"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath,
      completedCommands: [{ command: "npm ls @rollup/rollup-darwin-arm64 rollup vite", exitCode: 0 }]
    });

    expect(result.status).toBe("completed");
    expect(result.mutationStatus).toBe("none");
    expect(result.commandsRun).toEqual(["npm run build", "npm run ingest:ci"]);
  });

  it("refuses to execute in the linked repo path", async () => {
    const rootDir = await tempRoot();
    const linkedRepoPath = path.join(rootDir, "linked-repo");
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run build"],
      humanApprovedWindow: true,
      execute: true,
      sandboxPath: linkedRepoPath,
      linkedRepoPath
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("linked repo path");
    expect(calls).toBe(0);
  });

  it("dry-runs approved windows without executing commands", async () => {
    const rootDir = await tempRoot();
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new SandboxCommandWindow(rootDir, runner).run({
      packet,
      commands: ["npm run build"],
      humanApprovedWindow: true,
      execute: false
    });

    expect(result.status).toBe("ready");
    expect(result.commandResults[0]?.status).toBe("planned");
    expect(result.commandsRun).toHaveLength(0);
    expect(calls).toBe(0);
  });
});
