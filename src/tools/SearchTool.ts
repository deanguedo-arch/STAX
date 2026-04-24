import fs from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./Tool.js";

export class SearchTool implements Tool {
  name = "search";
  enabled = true;

  constructor(private rootDir = process.cwd()) {}

  async run(input: string): Promise<ToolResult> {
    const [root = ".", query = ""] = input.split("::", 2);
    const repoRoot = path.resolve(this.rootDir);
    const searchRoot = path.resolve(repoRoot, root);
    if (searchRoot !== repoRoot && !searchRoot.startsWith(`${repoRoot}${path.sep}`)) {
      return { ok: false, output: "Search denied outside repo root." };
    }
    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
          }
          await walk(full);
          continue;
        }
        const text = await fs.readFile(full, "utf8").catch(() => "");
        if (text.toLowerCase().includes(query.toLowerCase())) {
          results.push(full);
        }
      }
    }

    await walk(searchRoot);
    return { ok: true, output: results.join("\n") };
  }
}
