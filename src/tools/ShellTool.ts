import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Tool, ToolResult } from "./Tool.js";

const execFileAsync = promisify(execFile);

export class ShellTool implements Tool {
  name = "shell";

  constructor(public enabled = false) {}

  async run(input: string): Promise<ToolResult> {
    if (!this.enabled) {
      return { ok: false, output: "Shell tool is disabled." };
    }
    const [command, ...args] = input.split(" ");
    if (!command) {
      return { ok: false, output: "No command supplied." };
    }
    const result = await execFileAsync(command, args);
    return { ok: true, output: result.stdout };
  }
}
