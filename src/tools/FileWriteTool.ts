import fs from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./Tool.js";
import { defaultCapabilityRegistry } from "../capabilities/CapabilityRegistry.js";

export class FileWriteTool implements Tool {
  name = "fileWrite";
  capabilityId = "file.write";

  constructor(
    public enabled = false,
    private rootDir = process.cwd(),
    private approved = false,
    private artifactPath?: string,
    private rollbackPlan?: string
  ) {}

  async run(input: string): Promise<ToolResult> {
    if (!this.enabled) {
      return { ok: false, output: "File write tool is disabled." };
    }
    const capability = defaultCapabilityRegistry().decide({
      capabilityId: this.capabilityId,
      context: "local_stax",
      approved: this.approved,
      artifactPath: this.artifactPath,
      rollbackPlan: this.rollbackPlan
    });
    if (!capability.allowed) {
      return { ok: false, output: `File write denied: ${capability.reason}` };
    }
    const parsed = JSON.parse(input) as { path: string; content: string };
    const root = path.resolve(this.rootDir);
    const target = path.resolve(root, parsed.path);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return { ok: false, output: "File write denied outside repo root." };
    }
    await fs.writeFile(target, parsed.content, "utf8");
    return { ok: true, output: target };
  }
}
