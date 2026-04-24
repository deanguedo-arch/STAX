import fs from "node:fs/promises";
import type { Tool, ToolResult } from "./Tool.js";

export class FileWriteTool implements Tool {
  name = "fileWrite";

  constructor(public enabled = false) {}

  async run(input: string): Promise<ToolResult> {
    if (!this.enabled) {
      return { ok: false, output: "File write tool is disabled." };
    }
    const parsed = JSON.parse(input) as { path: string; content: string };
    await fs.writeFile(parsed.path, parsed.content, "utf8");
    return { ok: true, output: parsed.path };
  }
}
