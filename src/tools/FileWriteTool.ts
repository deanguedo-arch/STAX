import fs from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./Tool.js";

export class FileWriteTool implements Tool {
  name = "fileWrite";

  constructor(public enabled = false, private rootDir = process.cwd()) {}

  async run(input: string): Promise<ToolResult> {
    if (!this.enabled) {
      return { ok: false, output: "File write tool is disabled." };
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
