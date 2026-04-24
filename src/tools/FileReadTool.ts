import fs from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./Tool.js";

export class FileReadTool implements Tool {
  name = "fileRead";
  enabled = true;

  constructor(private rootDir = process.cwd()) {}

  async run(input: string): Promise<ToolResult> {
    const root = path.resolve(this.rootDir);
    const target = path.resolve(root, input);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return { ok: false, output: "File read denied outside repo root." };
    }
    const output = await fs.readFile(target, "utf8");
    return { ok: true, output };
  }
}
