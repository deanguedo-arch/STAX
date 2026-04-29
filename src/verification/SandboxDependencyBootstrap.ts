import fs from "node:fs/promises";
import path from "node:path";
import { CommandEvidenceStore } from "../evidence/CommandEvidenceStore.js";
import { SandboxGuard } from "./SandboxGuard.js";
import type { SandboxCommandRunner } from "./SandboxCommandWindow.js";
import {
  SandboxDependencyBootstrapInputSchema,
  SandboxDependencyBootstrapResultSchema,
  type SandboxDependencyBootstrapInput,
  type SandboxDependencyBootstrapResult
} from "./SandboxDependencyBootstrapSchemas.js";

const ALLOWED_BOOTSTRAP_COMMANDS = [
  "npm ci",
  "npm install --package-lock-only",
  "npm ls @rollup/rollup-darwin-arm64 rollup vite"
];

const HARD_BLOCKED = [
  "npm install --force",
  "npm audit fix",
  "npm update",
  "npm dedupe",
  "npm run ingest:seed-gold",
  "git push",
  "git reset --hard"
];

export class SandboxDependencyBootstrap {
  constructor(
    private rootDir = process.cwd(),
    private runner: SandboxCommandRunner = defaultBootstrapRunner
  ) {}

  async run(input: SandboxDependencyBootstrapInput): Promise<SandboxDependencyBootstrapResult> {
    const parsed = SandboxDependencyBootstrapInputSchema.parse(input);
    if (!parsed.humanApprovedBootstrap) {
      return result({
        status: "approval_required",
        parsed,
        commandsPlanned: [],
        commandsRun: [],
        commandResults: [],
        evidenceIds: [],
        changedFiles: [],
        blockingReasons: ["Human approval is required before sandbox dependency bootstrap."],
        manifestRefreshed: false,
        summary: "Sandbox dependency bootstrap did not run because approval is missing."
      });
    }

    const guard = new SandboxGuard();
    const verified = await guard.verify({
      workspace: parsed.workspace,
      packetId: parsed.packet.packetId,
      sourceRepoPath: parsed.linkedRepoPath,
      sandboxPath: parsed.sandboxPath
    });
    if (!verified.allowedForCommandWindow) {
      return result({
        status: "blocked",
        parsed,
        commandsPlanned: [],
        commandsRun: [],
        commandResults: [],
        evidenceIds: [],
        changedFiles: [],
        blockingReasons: [`Sandbox manifest must verify before dependency bootstrap: ${verified.blockingReasons.join("; ")}`],
        manifestRefreshed: false,
        summary: "Sandbox dependency bootstrap blocked before running commands."
      });
    }

    const commands = parsed.commands ?? await this.planCommands(parsed.sandboxPath, parsed.repairLockfile);
    const commandBlocker = commands.map((command) => bootstrapCommandBlocker(command)).find(Boolean);
    if (commandBlocker) {
      return result({
        status: "blocked",
        parsed,
        commandsPlanned: commands,
        commandsRun: [],
        commandResults: [],
        evidenceIds: [],
        changedFiles: [],
        blockingReasons: [commandBlocker],
        manifestRefreshed: false,
        summary: "Sandbox dependency bootstrap blocked a non-allowlisted command."
      });
    }

    if (!parsed.execute) {
      return result({
        status: "ready",
        parsed,
        commandsPlanned: commands,
        commandsRun: [],
        commandResults: commands.map((command) => ({ command, status: "planned", summary: "Command is allowlisted but was not executed in dry-run mode." })),
        evidenceIds: [],
        changedFiles: [],
        blockingReasons: [],
        manifestRefreshed: false,
        nextStep: "Approve execution to bootstrap sandbox dependencies, then run build and ingest:ci.",
        summary: "Sandbox dependency bootstrap is approved and planned but not executed."
      });
    }

    const trackedBefore = await readTrackedDependencyFiles(parsed.sandboxPath);
    const commandsRun: string[] = [];
    const commandResults: SandboxDependencyBootstrapResult["commandResults"] = [];
    const evidenceIds: string[] = [];
    for (const command of commands) {
      const outcome = await this.runner({ command, cwd: parsed.sandboxPath });
      commandsRun.push(command);
      const summary = `${command} ${outcome.exitCode === 0 ? "passed" : "failed"} in sandbox dependency bootstrap. cwd=${parsed.sandboxPath}`;
      const evidence = await new CommandEvidenceStore(this.rootDir).record({
        command,
        args: command.split(/\s+/).slice(1),
        exitCode: outcome.exitCode,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        summary,
        cwd: parsed.sandboxPath,
        workspace: parsed.workspace,
        linkedRepoPath: parsed.linkedRepoPath
      });
      evidenceIds.push(evidence.commandEvidenceId);
      commandResults.push({
        command,
        status: outcome.exitCode === 0 ? "passed" : "failed",
        exitCode: outcome.exitCode,
        evidenceId: evidence.commandEvidenceId,
        summary
      });
      if (outcome.exitCode !== 0) {
        return result({
          status: "stopped",
          parsed,
          commandsPlanned: commands,
          commandsRun,
          commandResults,
          evidenceIds,
          changedFiles: [],
          blockingReasons: [],
          firstRemainingFailure: `${command} failed with exit code ${outcome.exitCode}.`,
          manifestRefreshed: false,
          summary: "Sandbox dependency bootstrap stopped on failed command evidence."
        });
      }
    }

    const trackedAfter = await readTrackedDependencyFiles(parsed.sandboxPath);
    const changedFiles = changedTrackedFiles(trackedBefore, trackedAfter);
    let manifestRefreshed = false;
    if (changedFiles.length) {
      const refreshed = await guard.refreshIntegrityAfterPatch({
        workspace: parsed.workspace,
        packetId: parsed.packet.packetId,
        sourceRepoPath: parsed.linkedRepoPath,
        sandboxPath: parsed.sandboxPath,
        patchEvidenceId: evidenceIds.at(-1) ?? "sandbox_dependency_bootstrap",
        changedFiles,
        diffPath: undefined
      });
      manifestRefreshed = refreshed.allowedForCommandWindow;
      if (!manifestRefreshed) {
        return result({
          status: "blocked",
          parsed,
          commandsPlanned: commands,
          commandsRun,
          commandResults,
          evidenceIds,
          changedFiles,
          blockingReasons: [`Sandbox manifest refresh failed after dependency bootstrap: ${refreshed.blockingReasons.join("; ")}`],
          manifestRefreshed,
          summary: "Sandbox dependency bootstrap ran, but post-bootstrap manifest refresh failed."
        });
      }
    }

    return result({
      status: "bootstrapped",
      parsed,
      commandsPlanned: commands,
      commandsRun,
      commandResults,
      evidenceIds,
      changedFiles,
      manifestRefreshed,
      nextStep: "Run npm run build, then npm run ingest:ci only after build passes.",
      summary: "Sandbox dependency bootstrap completed in the sandbox and recorded command evidence."
    });
  }

  private async planCommands(sandboxPath: string, repairLockfile: boolean): Promise<string[]> {
    const commands: string[] = [];
    const nodeModulesMissing = !(await exists(path.join(sandboxPath, "node_modules")));
    if (nodeModulesMissing) commands.push("npm ci");
    if (repairLockfile) commands.push("npm install --package-lock-only");
    commands.push("npm ls @rollup/rollup-darwin-arm64 rollup vite");
    return commands;
  }
}

function bootstrapCommandBlocker(command: string): string | undefined {
  const normalized = normalizeCommand(command);
  if (HARD_BLOCKED.some((blocked) => normalized === normalizeCommand(blocked))) return `${command} is hard-blocked for sandbox dependency bootstrap.`;
  if (!ALLOWED_BOOTSTRAP_COMMANDS.some((allowed) => normalized === normalizeCommand(allowed))) return `${command} is not allowlisted for sandbox dependency bootstrap.`;
  return undefined;
}

function result(input: {
  status: SandboxDependencyBootstrapResult["status"];
  parsed: ReturnType<typeof SandboxDependencyBootstrapInputSchema.parse>;
  commandsPlanned: string[];
  commandsRun: string[];
  commandResults: SandboxDependencyBootstrapResult["commandResults"];
  evidenceIds: string[];
  changedFiles: string[];
  blockingReasons?: string[];
  firstRemainingFailure?: string;
  manifestRefreshed: boolean;
  nextStep?: string;
  summary: string;
}): SandboxDependencyBootstrapResult {
  return SandboxDependencyBootstrapResultSchema.parse({
    status: input.status,
    packetId: input.parsed.packet.packetId,
    execute: input.parsed.execute,
    commandsPlanned: input.commandsPlanned,
    commandsRun: input.commandsRun,
    commandResults: input.commandResults,
    evidenceIds: input.evidenceIds,
    changedFiles: input.changedFiles,
    blockingReasons: input.blockingReasons ?? [],
    firstRemainingFailure: input.firstRemainingFailure,
    manifestRefreshed: input.manifestRefreshed,
    nextStep: input.nextStep,
    summary: input.summary
  });
}

async function readTrackedDependencyFiles(sandboxPath: string): Promise<Map<string, string | undefined>> {
  const files = new Map<string, string | undefined>();
  for (const file of ["package.json", "package-lock.json"]) {
    files.set(file, await fs.readFile(path.join(sandboxPath, file), "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }));
  }
  return files;
}

function changedTrackedFiles(before: Map<string, string | undefined>, after: Map<string, string | undefined>): string[] {
  return Array.from(after.entries())
    .filter(([file, text]) => before.get(file) !== text)
    .map(([file]) => file);
}

async function exists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then((stat) => stat.isDirectory() || stat.isFile()).catch(() => false);
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

async function defaultBootstrapRunner(input: { command: string; cwd: string }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const parts = input.command.split(/\s+/);
  if (parts[0] !== "npm") throw new Error(`Unsupported executable: ${parts[0]}`);
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    const { stdout, stderr } = await execFileAsync(executable, parts.slice(1), {
      cwd: input.cwd,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 8
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const candidate = error as { code?: unknown; stdout?: unknown; stderr?: unknown };
    return {
      exitCode: typeof candidate.code === "number" ? candidate.code : 1,
      stdout: typeof candidate.stdout === "string" ? candidate.stdout : "",
      stderr: typeof candidate.stderr === "string" ? candidate.stderr : error instanceof Error ? error.message : String(error)
    };
  }
}
