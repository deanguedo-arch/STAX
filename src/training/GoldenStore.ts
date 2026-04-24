import fs from "node:fs/promises";
import path from "node:path";

export class GoldenStore {
  constructor(private rootDir = process.cwd()) {}

  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(path.join(this.rootDir, "goldens"));
      return entries.filter((entry) => entry.endsWith(".md"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
