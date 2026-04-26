import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CommandEvidenceStore } from "../evidence/CommandEvidenceStore.js";
import { WorkspaceContext } from "../workspace/WorkspaceContext.js";
import {
  VerificationResultSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  type VerificationResult
} from "./LearningWorker.js";

const execFileAsync = promisify(execFile);

const exactAllowedCommands = new Set([
  "npm run typecheck",
  "npm test",
  "npm run rax -- eval",
  "npm run rax -- eval --regression",
  "npm run rax -- eval --redteam"
]);

export class VerificationWorker {
  constructor(private rootDir = process.cwd()) {}

  async verify(input: {
    patchId: string;
    commands: string[];
    execute?: boolean;
  }): Promise<{ path: string; result: VerificationResult }> {
    await ensureLabDirs(this.rootDir);
    const commandsRun: string[] = [];
    const failures: string[] = [];
    for (const command of input.commands) {
      if (!this.isAllowed(command)) {
        failures.push(`disallowed command: ${command}`);
        continue;
      }
      commandsRun.push(command);
      if (input.execute) {
        try {
          const output = await this.runAllowed(command);
          const workspace = await new WorkspaceContext(this.rootDir).resolve();
          await new CommandEvidenceStore(this.rootDir).record({
            command,
            args: command.split(/\s+/).slice(1),
            exitCode: 0,
            stdout: output.stdout,
            stderr: output.stderr,
            summary: `${command} passed during lab verification.`,
            workspace: workspace.workspace,
            linkedRepoPath: workspace.linkedRepoPath
          });
        } catch (error) {
          failures.push(`${command}: ${error instanceof Error ? error.message : String(error)}`);
          const detail = commandErrorOutput(error);
          const workspace = await new WorkspaceContext(this.rootDir).resolve();
          await new CommandEvidenceStore(this.rootDir).record({
            command,
            args: command.split(/\s+/).slice(1),
            exitCode: detail.exitCode,
            stdout: detail.stdout,
            stderr: detail.stderr || (error instanceof Error ? error.message : String(error)),
            summary: `${command} failed during lab verification.`,
            workspace: workspace.workspace,
            linkedRepoPath: workspace.linkedRepoPath
          });
        }
      }
    }
    const result = VerificationResultSchema.parse({
      verificationId: labId("verification"),
      patchId: input.patchId,
      commandsRun,
      passed: failures.length === 0,
      failures,
      createdAt: new Date().toISOString(),
      skipped: input.execute ? undefined : true
    });
    const file = path.join(this.rootDir, "learning", "lab", "verification", `${result.verificationId}.json`);
    await fs.writeFile(file, JSON.stringify(result, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), result };
  }

  isAllowed(command: string): boolean {
    return exactAllowedCommands.has(command) || /^npm run rax -- replay [A-Za-z0-9_.:-]+$/.test(command);
  }

  private async runAllowed(command: string): Promise<{ stdout: string; stderr: string }> {
    const parts = command.split(/\s+/);
    if (parts[0] !== "npm") {
      throw new Error(`Unsupported executable: ${parts[0]}`);
    }
    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    const { stdout, stderr } = await execFileAsync(executable, parts.slice(1), {
      cwd: this.rootDir,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 8
    });
    return { stdout, stderr };
  }
}

function commandErrorOutput(error: unknown): { exitCode: number; stdout: string; stderr: string } {
  const candidate = error as { code?: unknown; stdout?: unknown; stderr?: unknown };
  return {
    exitCode: typeof candidate.code === "number" ? candidate.code : 1,
    stdout: typeof candidate.stdout === "string" ? candidate.stdout : "",
    stderr: typeof candidate.stderr === "string" ? candidate.stderr : ""
  };
}
