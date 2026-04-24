import fs from "node:fs/promises";
import type { Tool, ToolResult } from "./Tool.js";

export class FileReadTool implements Tool {
  name = "fileRead";
  enabled = true;

  async run(input: string): Promise<ToolResult> {
    const output = await fs.readFile(input, "utf8");
    return { ok: true, output };
  }
}
