import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { SandboxGuard } from "../src/verification/SandboxGuard.js";
import { SandboxPatchWindow } from "../src/verification/SandboxPatchWindow.js";
import { WorkPacketPlanner } from "../src/verification/WorkPacketPlanner.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

const execFileAsync = promisify(execFile);

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-sandbox-patch-window-"));
}

async function fixtureRepo(rootDir: string): Promise<string> {
  const repo = path.join(rootDir, "linked-brightspace");
  await fs.mkdir(path.join(repo, "src"), { recursive: true });
  await fs.mkdir(path.join(repo, "tmp"), { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "node -e \"console.log('build ok')\"" } }), "utf8");
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

function cliInvocation(args: string[]): { command: string; commandArgs: string[] } {
  const repoRoot = process.cwd();
  const tsxBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const cliPath = path.join(repoRoot, "src", "cli.ts");
  return {
    command: process.platform === "win32" ? "cmd.exe" : tsxBin,
    commandArgs: process.platform === "win32" ? ["/c", tsxBin, cliPath, ...args] : [cliPath, ...args]
  };
}

describe("SandboxPatchWindow", () => {
  it("does not patch without approval", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({ sourceRepoPath, sandboxPath, humanApprovedSandbox: true });

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{ filePath: "tmp/.gitkeep", content: "patched\n" }],
      sandboxPath,
      linkedRepoPath: sourceRepoPath
    });

    expect(result.status).toBe("approval_required");
    expect(await fs.readFile(path.join(sandboxPath, "tmp", ".gitkeep"), "utf8")).toBe("");
  });

  it("blocks patching when the sandbox manifest does not verify", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await fs.mkdir(sandboxPath, { recursive: true });

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{ filePath: "tmp/.gitkeep", content: "patched\n" }],
      humanApprovedPatch: true,
      sandboxPath,
      linkedRepoPath: sourceRepoPath
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("Sandbox must verify before patching");
  });

  it("hard-blocks forbidden or disallowed files", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({ sourceRepoPath, sandboxPath, humanApprovedSandbox: true });

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{ filePath: "src/index.ts", content: "export const changed = true;\n" }],
      humanApprovedPatch: true,
      sandboxPath,
      linkedRepoPath: sourceRepoPath
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("src/index.ts matches a forbidden file boundary");
  });

  it("requires explicit justification before package.json patching", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({ sourceRepoPath, sandboxPath, humanApprovedSandbox: true });

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{ filePath: "package.json", content: JSON.stringify({ scripts: { build: "node build.js" } }) }],
      humanApprovedPatch: true,
      sandboxPath,
      linkedRepoPath: sourceRepoPath
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("package.json patching requires an explicit justification");
  });

  it("allows package.json patching when explicitly justified", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({ sourceRepoPath, sandboxPath, humanApprovedSandbox: true });

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{
        filePath: "package.json",
        content: JSON.stringify({ scripts: { build: "node -e \"console.log('build ok')\"" }, private: true }),
        justification: "Keep dependency repair metadata explicit in sandbox only."
      }],
      humanApprovedPatch: true,
      sandboxPath,
      linkedRepoPath: sourceRepoPath
    });

    expect(result.status).toBe("patched");
    expect(result.changedFiles[0]?.filePath).toBe("package.json");
  });

  it("applies approved sandbox-only patches, records diff evidence, and refreshes integrity manifest", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new SandboxGuard().create({
      workspace: "brightspacequizexporter",
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{ filePath: "package-lock.json", content: "{\"lockfileVersion\":3,\"patched\":true}\n" }],
      humanApprovedPatch: true,
      sandboxPath,
      linkedRepoPath: sourceRepoPath,
      workspace: "brightspacequizexporter"
    });
    const verified = await new SandboxGuard().verify({
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath
    });
    const manifest = JSON.parse(await fs.readFile(path.join(sandboxPath, ".stax-sandbox.json"), "utf8")) as {
      patchHistory: Array<{ patchEvidenceId: string; changedFiles: string[] }>;
    };

    expect(result.status).toBe("patched");
    expect(result.mutationStatus).toBe("sandbox_only");
    expect(result.changedFiles[0]?.filePath).toBe("package-lock.json");
    expect(result.diffPath).toMatch(/evidence\/patches\//);
    expect(result.postPatchRequiredCommands).toEqual([
      "npm ls @rollup/rollup-darwin-arm64 rollup vite",
      "npm run build",
      "npm run ingest:ci"
    ]);
    expect(verified.status).toBe("verified");
    expect(manifest.patchHistory[0]?.patchEvidenceId).toBe(result.patchEvidenceId);
    expect(manifest.patchHistory[0]?.changedFiles).toEqual(["package-lock.json"]);
    expect(await fs.readFile(path.join(sourceRepoPath, "package-lock.json"), "utf8")).toBe("{\"lockfileVersion\":3}\n");
  });

  it("refuses to patch the linked repo path directly", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);

    const result = await new SandboxPatchWindow(rootDir).run({
      packet: packet(sourceRepoPath),
      operations: [{ filePath: "package-lock.json", content: "{}\n" }],
      humanApprovedPatch: true,
      sandboxPath: sourceRepoPath,
      linkedRepoPath: sourceRepoPath
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasons.join("\n")).toContain("Sandbox must verify before patching");
  });

  it("exposes a CLI patch window and allows command-window verification after patch", async () => {
    const rootDir = await tempRoot();
    const sourceRepoPath = await fixtureRepo(rootDir);
    const sandboxPath = path.join(rootDir, "sandbox");
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: sourceRepoPath, use: true });
    await new SandboxGuard().create({
      workspace: "brightspacequizexporter",
      packetId: "repair_rollup_install_integrity",
      sourceRepoPath,
      sandboxPath,
      humanApprovedSandbox: true
    });
    const patchCli = cliInvocation([
      "auto-advance",
      "patch-window",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--sandbox-path",
      sandboxPath,
      "--file",
      "tmp/.gitkeep",
      "--content",
      "patched-marker\n",
      "--approve"
    ]);
    const commandCli = cliInvocation([
      "auto-advance",
      "command-window",
      "brightspace-rollup",
      "--workspace",
      "brightspacequizexporter",
      "--sandbox-path",
      sandboxPath,
      "--command",
      "npm run build",
      "--completed-ls",
      "--approve",
      "--execute"
    ]);

    const patched = JSON.parse((await execFileAsync(patchCli.command, patchCli.commandArgs, { cwd: rootDir })).stdout) as { status: string; diffPath: string };
    const command = JSON.parse((await execFileAsync(commandCli.command, commandCli.commandArgs, { cwd: rootDir })).stdout) as { status: string; commandsRun: string[] };

    expect(patched.status).toBe("patched");
    expect(patched.diffPath).toMatch(/evidence\/patches\//);
    expect(command.commandsRun).toEqual(["npm run build"]);
    expect(["command_recorded", "completed"]).toContain(command.status);
  }, 30000);
});
