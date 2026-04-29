import fs from "node:fs/promises";
import path from "node:path";
import { createRunId } from "../utils/ids.js";
import type { MemoryRecord, MemoryType } from "./memoryTypes.js";

export type MemoryAddInput = {
  type: MemoryType;
  content: string;
  sourceRunId?: string;
  expiresAt?: string;
  confidence?: "low" | "medium" | "high";
  approved?: boolean;
  tags?: string[];
};

export class MemoryStore {
  constructor(private rootDir = process.cwd()) {}

  private file(type: MemoryType | "session" | "project"): string {
    return path.join(this.rootDir, "memory", String(type), "memory.json");
  }

  async add(
    scopeOrInput: "session" | "project" | MemoryAddInput,
    text?: string,
    tags: string[] = []
  ): Promise<MemoryRecord> {
    const input: MemoryAddInput =
      typeof scopeOrInput === "string"
        ? {
            type: scopeOrInput,
            content: text ?? "",
            tags,
            approved: false,
            confidence: "medium"
          }
        : scopeOrInput;

    const record: MemoryRecord = {
      id: createRunId(),
      type: input.type,
      scope: input.type === "session" || input.type === "project" ? input.type : undefined,
      content: input.content,
      text: input.content,
      sourceRunId: input.sourceRunId,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      confidence: input.confidence ?? "medium",
      approved: input.approved ?? false,
      tags: input.tags ?? []
    };

    const records = await this.all(input.type);
    records.push(record);
    const file = this.file(input.type);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(records, null, 2), "utf8");
    return record;
  }

  async all(type: MemoryType | "session" | "project"): Promise<MemoryRecord[]> {
    try {
      const raw = await fs.readFile(this.file(type), "utf8");
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
    const terms = lower
      .split(/[^a-z0-9_]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length > 2);
    const types: MemoryType[] = PROJECT_MEMORY_TYPES;
    const now = Date.now();
    const groups = await Promise.all(types.map((type) => this.all(type)));
    return groups
      .flat()
      .filter((record) => record.approved)
      .filter((record) => !record.expiresAt || Date.parse(record.expiresAt) > now)
      .filter((record) => {
        if (!lower) return true;
        const haystack = [record.content, ...record.tags].join(" ").toLowerCase();
        return haystack.includes(lower) || terms.some((term) => haystack.includes(term));
      });
  }

  async approve(id: string): Promise<MemoryRecord> {
    return this.setApproval(id, true);
  }

  async reject(id: string): Promise<MemoryRecord> {
    return this.setApproval(id, false);
  }

  private async setApproval(id: string, approved: boolean): Promise<MemoryRecord> {
    const types: MemoryType[] = PROJECT_MEMORY_TYPES;
    for (const type of types) {
      const records = await this.all(type);
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) continue;
      const updated = { ...records[index]!, approved };
      records[index] = updated;
      const file = this.file(type);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(records, null, 2), "utf8");
      return updated;
    }
    throw new Error(`Memory not found: ${id}`);
  }
}

export const PROJECT_MEMORY_TYPES: MemoryType[] = [
  "session",
  "project",
  "user_preference",
  "correction",
  "golden",
  "example",
  "forbidden",
  "decision",
  "known_failure",
  "proven_working",
  "unproven_claim",
  "next_action",
  "risk"
];
