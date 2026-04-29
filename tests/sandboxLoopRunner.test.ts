import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { HumanApplyPacketBuilder } from "../src/execution/HumanApplyPacket.js";
import { LoopStopGate } from "../src/loop/LoopStopGate.js";
import { SandboxLoopRunner } from "../src/loop/SandboxLoopRunner.js";
import type { PatchProofChainResult } from "../src/verification/PatchProofChainSchemas.js";
import { WorkPacketPlanner } from "../src/verification/WorkPacketPlanner.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

const execFileAsync = promisify(execFile);

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-sandbox-loop-runner-"));
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

function fakeChainResult(input: Partial<PatchProofChainResult>): PatchProofChainResult {
  const changedFiles = input.changedFiles ?? [];
  const commandResults = input.commandResults ?? [];
  const evidenceIds = input.evidenceIds ?? [];
  const applyPacket = new HumanApplyPacketBuilder().build({
    status: input.status === "sandbox_verified" ? "sandbox_verified" : input.status === "sandbox_failed" ? "sandbox_failed" : "blocked",
    packetId: "repair_rollup_install_integrity",
    sandboxPath: "/tmp/sandbox",
    linkedRepoPath: "/repo/brightspace",
    changedFiles,
    patchDiffPath: input.patchDiffPath,
    commandResults,
    commandEvidenceIds: evidenceIds,
    firstRemainingFailure: input.firstRemainingFailure,
    blockingReasons: input.blockingReasons ?? [],
    forbiddenDiff: input.blockingReasons?.some((reason) => reason.includes("forbidden")) ?? false
  });
  return {
    status: input.status ?? "blocked",
    packetId: "repair_rollup_install_integrity",
    patchDiffPath: input.patchDiffPath,
    patchEvidenceId: input.patchEvidenceId,
    commandsRun: input.commandsRun ?? [],
    commandResults,
    evidenceIds,
    firstRemainingFailure: input.firstRemainingFailure,
    changedFiles,
    applyRecommendation: applyPacket.recommendation,
    applyPacket,
    blockingReasons: input.blockingReasons ?? [],
    summary: input.summary ?? "fake chain result"
  };
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

describe("SandboxLoopRunner", () => {
  it("runs 100 dry-run loops without mutating linked repos", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const before = await fs.readFile(path.join(sourceRepoPath, "package-lock.json"), "utf8");

    const result = await new SandboxLoopRunner(rootDir).run({
      packet: packet(sourceRepoPath),
      mode: "dry_run",
      sandboxPath: path.join(rootDir, "sandbox"),
      linkedRepoPath: sourceRepoPath,
      budget: { maxLoops: 100 }
    });

    expect(result.status).toBe("needs_human_decision");
    expect(result.mutatedLinkedRepo).toBe(false);
    expect(await fs.readFile(path.join(sourceRepoPath, "package-lock.json"), "utf8")).toBe(before);
  });

  it("stops early when the goal is verified and returns a human apply packet", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const result = await new SandboxLoopRunner(rootDir, undefined, async () => fakeChainResult({
      status: "sandbox_verified",
      patchDiffPath: "evidence/patches/diff.txt",
      changedFiles: [{
        filePath: "package-lock.json",
        beforeHash: "a".repeat(64),
        afterHash: "b".repeat(64),
        beforeSizeBytes: 10,
        afterSizeBytes: 12,
        created: false
      }],
      commandResults: [{ command: "npm run build", status: "passed", exitCode: 0, evidenceId: "cmd-ev-build" }],
      evidenceIds: ["cmd-ev-build"]
    })).run({
      packet: packet(sourceRepoPath),
      mode: "sandbox_patch",
      sandboxPath: path.join(rootDir, "sandbox"),
      linkedRepoPath: sourceRepoPath,
      humanApprovedPatch: true,
      humanApprovedCommandWindow: true,
      execute: true,
      operations: [{ filePath: "package-lock.json", content: "{}\n" }]
    });

    expect(result.stopReason).toBe("goal_verified");
    expect(result.applyPacket?.requiresHumanApproval).toBe(true);
    expect(result.applyPacket?.appliedToRealRepo).toBe(false);
  });

  it("stops after repeated same next step", () => {
    const stop = new LoopStopGate().evaluate({
      plannedStepIds: ["inspect", "repair", "repair", "repair"]
    });

    expect(stop.shouldStop).toBe(true);
    expect(stop.reason).toBe("same_next_step_repeated_3_times");
  });

  it("stops after two failed patch attempts", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const result = await new SandboxLoopRunner(rootDir).run({
      packet: packet(sourceRepoPath),
      mode: "sandbox_patch",
      sandboxPath: path.join(rootDir, "sandbox"),
      linkedRepoPath: sourceRepoPath,
      patchFailureCount: 2
    });

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("two_patch_failures");
  });

  it("stops sandbox command loop on failed command evidence", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const result = await new SandboxLoopRunner(rootDir, undefined, async () => fakeChainResult({
      status: "sandbox_failed",
      firstRemainingFailure: "npm run build failed",
      commandsRun: ["npm run build"],
      commandResults: [{ command: "npm run build", status: "failed", exitCode: 1, evidenceId: "cmd-ev-build" }],
      evidenceIds: ["cmd-ev-build"]
    })).run({
      packet: packet(sourceRepoPath),
      mode: "sandbox_commands",
      sandboxPath: path.join(rootDir, "sandbox"),
      linkedRepoPath: sourceRepoPath,
      humanApprovedCommandWindow: true,
      execute: true
    });

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("failed_command");
    expect(result.firstRemainingFailure).toContain("build failed");
  });

  it("stops sandbox patch loop on forbidden diff", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const result = await new SandboxLoopRunner(rootDir, undefined, async () => fakeChainResult({
      status: "blocked",
      blockingReasons: ["src/index.ts matches a forbidden file boundary."]
    })).run({
      packet: packet(sourceRepoPath),
      mode: "sandbox_patch",
      sandboxPath: path.join(rootDir, "sandbox"),
      linkedRepoPath: sourceRepoPath,
      humanApprovedPatch: true,
      humanApprovedCommandWindow: true,
      execute: true,
      operations: [{ filePath: "src/index.ts", content: "bad\n" }]
    });

    expect(result.status).toBe("blocked");
    expect(result.stopReason).toBe("forbidden_diff");
  });

  it("exposes run-packet dry-run without command execution", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: sourceRepoPath, use: true });
    const cli = cliInvocation([
      "auto-advance",
      "run-packet",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--sandbox-path",
      path.join(rootDir, "sandbox"),
      "--dry-run"
    ]);

    const { stdout } = await execFileAsync(cli.command, cli.commandArgs, { cwd: rootDir });
    const output = JSON.parse(stdout) as { loop: { status: string; loopsRun: number; mutatedLinkedRepo: boolean } };

    expect(output.loop.status).toBe("needs_human_decision");
    expect(output.loop.loopsRun).toBe(0);
    expect(output.loop.mutatedLinkedRepo).toBe(false);
  }, 30000);

  it("exposes approved run-packet command proof only inside a sandbox", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: sourceRepoPath, use: true });
    const sandboxPath = path.join(rootDir, "sandbox");
    const cli = cliInvocation([
      "auto-advance",
      "run-packet",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--sandbox-path",
      sandboxPath,
      "--approve-sandbox",
      "--approve-window",
      "--command",
      "npm run build",
      "--max-loops",
      "100"
    ]);

    const { stdout } = await execFileAsync(cli.command, cli.commandArgs, { cwd: rootDir });
    const output = JSON.parse(stdout) as {
      sandbox: { allowedForCommandWindow: boolean; sandboxPath: string };
      loop: { status: string; chainResult: { commandsRun: string[] }; mutatedLinkedRepo: boolean };
    };

    expect(output.sandbox.allowedForCommandWindow).toBe(true);
    expect(output.sandbox.sandboxPath).toBe(sandboxPath);
    expect(output.loop.chainResult.commandsRun).toEqual(["npm run build"]);
    expect(output.loop.mutatedLinkedRepo).toBe(false);
    expect(await fs.readFile(path.join(sourceRepoPath, "package-lock.json"), "utf8")).toBe("{\"lockfileVersion\":3}\n");
  }, 30000);
});
