import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Tool, ToolResult } from "./Tool.js";
import { defaultCapabilityRegistry } from "../capabilities/CapabilityRegistry.js";

const execFileAsync = promisify(execFile);

export class ShellTool implements Tool {
  name = "shell";
  capabilityId = "shell.execute";

  constructor(public enabled = false, private approved = false, private artifactPath?: string) {}

  async run(input: string): Promise<ToolResult> {
    if (!this.enabled) {
      return { ok: false, output: "Shell tool is disabled." };
    }
    const capability = defaultCapabilityRegistry().decide({
      capabilityId: this.capabilityId,
      context: "local_stax",
      approved: this.approved,
      artifactPath: this.artifactPath
    });
    if (!capability.allowed) {
      return { ok: false, output: `Shell tool denied: ${capability.reason}` };
    }
    const [command, ...args] = input.split(" ");
    if (!command) {
      return { ok: false, output: "No command supplied." };
    }
    const result = await execFileAsync(command, args);
    return { ok: true, output: result.stdout };
  }
}
