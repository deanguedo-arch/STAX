import fs from "node:fs/promises";
import path from "node:path";
import type { StaxCoreReleaseArtifact } from "./ReleaseArtifactWriter.js";

export interface ReleaseArtifactSnapshot {
  path: string;
  artifact: StaxCoreReleaseArtifact;
}

async function collectJsonFiles(dir: string): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

export class ReleaseArtifactStore {
  constructor(private rootDir: string) {}

  async listRecent(limit = 10): Promise<ReleaseArtifactSnapshot[]> {
    const baseDir = path.join(this.rootDir, "runs", "staxcore_release");
    const files = await collectJsonFiles(baseDir);
    const parsed = await Promise.all(
      files.map(async (fullPath) => {
        const raw = await fs.readFile(fullPath, "utf8");
        const artifact = JSON.parse(raw) as StaxCoreReleaseArtifact;
        return {
          path: path.relative(this.rootDir, fullPath),
          artifact
        };
      })
    );

    return parsed
      .sort((a, b) => Date.parse(b.artifact.createdAt) - Date.parse(a.artifact.createdAt))
      .slice(0, limit);
  }

  async latest(): Promise<ReleaseArtifactSnapshot | null> {
    const entries = await this.listRecent(1);
    return entries[0] ?? null;
  }
}
