import fs from "node:fs/promises";
import path from "node:path";
import type { ExampleItem } from "../policy/policyTypes.js";

export class ExampleStore {
  constructor(private rootDir = process.cwd()) {}

  async search(mode: string, limit = 4): Promise<ExampleItem[]> {
    const dir = path.join(this.rootDir, "examples", mode);
    try {
      const entries = await fs.readdir(dir);
      const results: ExampleItem[] = [];
      for (const entry of entries.filter((item) => item.endsWith(".json")).slice(0, limit)) {
        results.push(JSON.parse(await fs.readFile(path.join(dir, entry), "utf8")) as ExampleItem);
      }
      return results;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
