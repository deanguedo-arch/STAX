import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PatchProofChain } from "../src/verification/PatchProofChain.js";
import type { SandboxCommandRunner } from "../src/verification/SandboxCommandWindow.js";
import { SandboxGuard } from "../src/verification/SandboxGuard.js";
import { WorkPacketPlanner } from "../src/verification/WorkPacketPlanner.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-patch-proof-chain-"));
}

async function fixtureRepo(rootDir: string): Promise<string> {
  const repo = path.join(rootDir, "linked-brightspace");
  await fs.mkdir(path.join(repo, "src"), { recursive: true });
  await fs.mkdir(path.join(repo, "tmp"), { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "node -e \"console.log('build ok')\"", "ingest:ci": "node -e \"console.log('ingest ok')\"" } }), "utf8");
  await fs.writeFile(path.join(repo, "package-lock.json"), "{\"lockfileVersion\":3}\n", "utf8");
  await fs.writeFile(path.join(repo, "src", "index.ts"), "export const ok = true;\n", "utf8");
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

describe("PatchProofChain", () => {
  it("verifies an approved sandbox patch after npm ls, build, and ingest:ci command evidence", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    const runner: SandboxCommandRunner = async () => ({ exitCode: 0, stdout: "ok", stderr: "" });

    const result = await new PatchProofChain(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedPatch: true,
      humanApprovedCommandWindow: true,
      execute: true,
      operations: [{ filePath: "package-lock.json", content: "{\"lockfileVersion\":3,\"patched\":true}\n" }]
    });

    expect(result.status).toBe("sandbox_verified");
    expect(result.applyRecommendation).toBe("apply");
    expect(result.changedFiles[0]?.filePath).toBe("package-lock.json");
    expect(result.commandsRun).toEqual([
      "npm ls @rollup/rollup-darwin-arm64 rollup vite",
      "npm run build",
      "npm run ingest:ci"
    ]);
    expect(result.evidenceIds).toHaveLength(3);
    expect(result.applyPacket.appliedToRealRepo).toBe(false);
    expect(await fs.readFile(path.join(sourceRepoPath, "package-lock.json"), "utf8")).toBe("{\"lockfileVersion\":3}\n");
  });

  it("stops failed build before ingest:ci runs", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    const runner: SandboxCommandRunner = async ({ command }) => ({
      exitCode: command === "npm run build" ? 1 : 0,
      stdout: "",
      stderr: command === "npm run build" ? "build failed" : ""
    });

    const result = await new PatchProofChain(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedCommandWindow: true,
      execute: true
    });

    expect(result.status).toBe("sandbox_failed");
    expect(result.commandsRun).toEqual(["npm ls @rollup/rollup-darwin-arm64 rollup vite", "npm run build"]);
    expect(result.firstRemainingFailure).toContain("npm run build failed");
    expect(result.applyRecommendation).toBe("do_not_apply");
  });

  it("blocks ingest:ci before build proof", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    let calls = 0;
    const runner: SandboxCommandRunner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await new PatchProofChain(rootDir, runner).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedCommandWindow: true,
      execute: true,
      commands: ["npm run ingest:ci"]
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("npm run build must pass");
    expect(calls).toBe(0);
  });

  it("blocks forbidden sandbox diffs before command proof", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);

    const result = await new PatchProofChain(rootDir).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedPatch: true,
      humanApprovedCommandWindow: true,
      execute: true,
      operations: [{ filePath: "src/index.ts", content: "export const changed = true;\n" }]
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("forbidden file boundary");
    expect(result.commandsRun).toHaveLength(0);
  });

  it("does not treat incomplete command proof as sandbox_verified", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);

    const result = await new PatchProofChain(rootDir).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedCommandWindow: true,
      execute: false
    });

    expect(result.status).not.toBe("sandbox_verified");
    expect(result.applyRecommendation).toBe("needs_review");
    expect(result.evidenceIds).toHaveLength(0);
  });

  it("blocks command proof after an unrefreshed sandbox mutation", async () => {
    const rootDir = await tempRoot();
    const { sourceRepoPath, sandboxPath } = await createSandbox(rootDir);
    await fs.writeFile(path.join(sandboxPath, "package-lock.json"), "{\"manual\":true}\n", "utf8");

    const result = await new PatchProofChain(rootDir).run({
      packet: packet(sourceRepoPath),
      workspace: "brightspacequizexporter",
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      humanApprovedCommandWindow: true,
      execute: true
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("Sandbox manifest must verify");
  });
});
