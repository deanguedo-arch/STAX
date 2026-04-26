import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
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
          await this.runAllowed(command);
        } catch (error) {
          failures.push(`${command}: ${error instanceof Error ? error.message : String(error)}`);
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

  private async runAllowed(command: string): Promise<void> {
    const parts = command.split(/\s+/);
    if (parts[0] !== "npm") {
      throw new Error(`Unsupported executable: ${parts[0]}`);
    }
    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    await execFileAsync(executable, parts.slice(1), {
      cwd: this.rootDir,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 8
    });
  }
}
