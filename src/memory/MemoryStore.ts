import fs from "node:fs/promises";
import path from "node:path";
import { createRunId } from "../utils/ids.js";
import type { MemoryRecord } from "./memoryTypes.js";

export class MemoryStore {
  constructor(private rootDir = process.cwd()) {}

  private file(scope: MemoryRecord["scope"]): string {
    return path.join(this.rootDir, "memory", `${scope}s`, "memory.json");
  }

  async add(
    scope: MemoryRecord["scope"],
    text: string,
    tags: string[] = []
  ): Promise<MemoryRecord> {
    const record: MemoryRecord = {
      id: createRunId(),
      scope,
      text,
      tags,
      createdAt: new Date().toISOString()
    };
    const records = await this.all(scope);
    records.push(record);
    const file = this.file(scope);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(records, null, 2), "utf8");
    return record;
  }

  async all(scope: MemoryRecord["scope"]): Promise<MemoryRecord[]> {
    try {
      const raw = await fs.readFile(this.file(scope), "utf8");
      return JSON.parse(raw) as MemoryRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async search(query: string): Promise<MemoryRecord[]> {
    const lower = query.toLowerCase();
    const records = [...(await this.all("session")), ...(await this.all("project"))];
    return records.filter(
      (record) =>
        record.text.toLowerCase().includes(lower) ||
        record.tags.some((tag) => tag.toLowerCase().includes(lower))
    );
  }
}
