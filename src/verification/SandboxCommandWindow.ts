import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { CommandEvidenceStore } from "../evidence/CommandEvidenceStore.js";
import { AutonomyWindowController } from "./AutonomyWindow.js";
import { CheckpointGate } from "./CheckpointGate.js";
import {
  SandboxCommandRunInputSchema,
  SandboxCommandWindowResultSchema,
  type SandboxCommandRunInput,
  type SandboxCommandWindowResult
} from "./SandboxCommandWindowSchemas.js";
import type { CheckpointCommandEvidence } from "./VerificationEconomySchemas.js";

const execFileAsync = promisify(execFile);

export type SandboxCommandRunner = (input: {
  command: string;
  cwd: string;
}) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export class SandboxCommandWindow {
  constructor(
    private rootDir = process.cwd(),
    private runner: SandboxCommandRunner = defaultCommandRunner
  ) {}

  async run(input: SandboxCommandRunInput): Promise<SandboxCommandWindowResult> {
    const parsed = SandboxCommandRunInputSchema.parse(input);
    const controller = new AutonomyWindowController();
    const window = controller.forPacket(parsed.packet);
    const blockingReasons: string[] = [];
    const commandResults: SandboxCommandWindowResult["commandResults"] = [];
    const evidenceIds: string[] = [];
    const commandsRun: string[] = [];
    const completed: CheckpointCommandEvidence[] = [...parsed.completedCommands];

    if (!parsed.humanApprovedWindow) {
      return result({
        status: "approval_required",
        parsed,
        commandResults,
        commandsRun,
        evidenceIds,
        blockingReasons: ["Human approval is required before the sandbox command window can run."],
        summary: "Sandbox command window did not run because approval is missing."
      });
    }

    if (parsed.execute && !parsed.sandboxPath) {
      return result({
        status: "blocked",
        parsed,
        commandResults,
        commandsRun,
        evidenceIds,
        blockingReasons: ["Sandbox path is required before command execution."],
        summary: "Sandbox command window did not run because sandboxPath is missing."
      });
    }

    if (parsed.execute && parsed.sandboxPath && parsed.linkedRepoPath && samePath(parsed.sandboxPath, parsed.linkedRepoPath)) {
      return result({
        status: "blocked",
        parsed,
        commandResults,
        commandsRun,
        evidenceIds,
        blockingReasons: ["Sandbox command window cannot execute in the linked repo path."],
        summary: "Sandbox command window refused to run in the linked repo path."
      });
    }

    for (const command of parsed.commands) {
      if (!parsed.execute) {
        const dryRunBlocker = dryRunCommandBlocker(command, controller, window);
        if (dryRunBlocker) {
          commandResults.push({ command, status: "blocked", summary: dryRunBlocker });
          blockingReasons.push(dryRunBlocker);
          return result({
            status: "blocked",
            parsed,
            commandResults,
            commandsRun,
            evidenceIds,
            blockingReasons,
            nextCheckpoint: nextCheckpoint(completed),
            summary: `Sandbox command window blocked ${command}.`
          });
        }
        commandResults.push({ command, status: "planned", summary: "Command is allowlisted but was not executed in dry-run mode." });
        continue;
      }

      const blocker = commandBlocker(command, controller, window, completed);
      if (blocker) {
        commandResults.push({ command, status: "blocked", summary: blocker });
        blockingReasons.push(blocker);
        return result({
          status: "blocked",
          parsed,
          commandResults,
          commandsRun,
          evidenceIds,
          blockingReasons,
          nextCheckpoint: nextCheckpoint(completed),
          summary: `Sandbox command window blocked ${command}.`
        });
      }

      const cwd = parsed.sandboxPath!;
      const outcome = await this.runner({ command, cwd });
      commandsRun.push(command);
      const summary = `${command} ${outcome.exitCode === 0 ? "passed" : "failed"} in sandbox command window. cwd=${cwd}`;
      const evidence = await new CommandEvidenceStore(this.rootDir).record({
        command,
        args: command.split(/\s+/).slice(1),
        exitCode: outcome.exitCode,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        summary,
        cwd,
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
      completed.push({ command, exitCode: outcome.exitCode, summary });

      if (outcome.exitCode !== 0) {
        return result({
          status: "stopped",
          parsed,
          commandResults,
          commandsRun,
          evidenceIds,
          blockingReasons,
          firstRemainingFailure: `${command} failed with exit code ${outcome.exitCode}.`,
          nextCheckpoint: "Report first remaining failure before continuing.",
          summary: "Sandbox command window stopped on failed command evidence."
        });
      }
    }

    if (!parsed.execute) {
      return result({
        status: "ready",
        parsed,
        commandResults,
        commandsRun,
        evidenceIds,
        blockingReasons,
        nextCheckpoint: nextCheckpoint(completed),
        summary: "Sandbox command window is approved and commands are allowlisted, but execution was not requested."
      });
    }

    const checkpoint = new CheckpointGate().evaluate({
      packet: parsed.packet,
      completedCommands: completed
    });
    return result({
      status: checkpoint.decision === "done" ? "completed" : "command_recorded",
      parsed,
      commandResults,
      commandsRun,
      evidenceIds,
      blockingReasons,
      nextCheckpoint: checkpoint.nextCheckpoint,
      summary: checkpoint.decision === "done"
        ? "Sandbox command window completed the packet command gates."
        : "Sandbox command window recorded command evidence and needs the next checkpoint."
    });
  }
}

function dryRunCommandBlocker(
  command: string,
  controller: AutonomyWindowController,
  window: ReturnType<AutonomyWindowController["forPacket"]>
): string | undefined {
  if (controller.isCommandHardBlocked(command, window)) return `${command} is hard-blocked for this packet.`;
  if (!controller.isCommandAllowed(command, window)) return `${command} is not allowlisted for this packet.`;
  return undefined;
}

function commandBlocker(
  command: string,
  controller: AutonomyWindowController,
  window: ReturnType<AutonomyWindowController["forPacket"]>,
  completed: CheckpointCommandEvidence[]
): string | undefined {
  if (controller.isCommandHardBlocked(command, window)) return `${command} is hard-blocked for this packet.`;
  if (!controller.isCommandAllowed(command, window)) return `${command} is not allowlisted for this packet.`;
  if (normalize(command) === "npm run ingest:ci" && !hasPassing(completed, "npm run build")) {
    return "npm run build must pass before npm run ingest:ci.";
  }
  return undefined;
}

function nextCheckpoint(completed: CheckpointCommandEvidence[]): string {
  if (!hasPassing(completed, "npm ls @rollup/rollup-darwin-arm64 rollup vite")) {
    return "Run and record npm ls @rollup/rollup-darwin-arm64 rollup vite.";
  }
  if (!hasPassing(completed, "npm run build")) return "Run and record npm run build.";
  if (!hasPassing(completed, "npm run ingest:ci")) return "Run and record npm run ingest:ci.";
  return "Packet command gates are complete.";
}

function hasPassing(commands: CheckpointCommandEvidence[], expected: string): boolean {
  return commands.some((item) => normalize(item.command) === normalize(expected) && item.exitCode === 0);
}

function normalize(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function result(input: {
  status: SandboxCommandWindowResult["status"];
  parsed: ReturnType<typeof SandboxCommandRunInputSchema.parse>;
  commandResults: SandboxCommandWindowResult["commandResults"];
  commandsRun: string[];
  evidenceIds: string[];
  blockingReasons: string[];
  firstRemainingFailure?: string;
  nextCheckpoint?: string;
  summary: string;
}): SandboxCommandWindowResult {
  return SandboxCommandWindowResultSchema.parse({
    status: input.status,
    packetId: input.parsed.packet.packetId,
    execute: input.parsed.execute,
    mutationStatus: "none",
    commandsPlanned: input.parsed.commands,
    commandsRun: input.commandsRun,
    commandResults: input.commandResults,
    evidenceIds: input.evidenceIds,
    blockingReasons: input.blockingReasons,
    firstRemainingFailure: input.firstRemainingFailure,
    nextCheckpoint: input.nextCheckpoint,
    summary: input.summary
  });
}

async function defaultCommandRunner(input: { command: string; cwd: string }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
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
