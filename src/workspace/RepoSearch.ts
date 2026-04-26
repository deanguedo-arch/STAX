import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import {
  isBinaryBuffer,
  isIgnoredPath,
  isInsideRepo,
  REPO_IGNORED_DIRS,
  REPO_MAX_FILE_BYTES,
  resolveRepoRoot
} from "./RepoSummary.js";

export type RepoSearchResult = {
  path: string;
  line: number;
  snippet: string;
  matchReason: string;
};

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml"
]);

export class RepoSearch {
  constructor(private repoPath: string) {}

  async search(query: string, options: { maxResults?: number } = {}): Promise<RepoSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) throw new Error("Search query is required.");
    const repoRoot = await resolveRepoRoot(this.repoPath);
    const results: RepoSearchResult[] = [];
    await this.visit(repoRoot, repoRoot, trimmed.toLowerCase(), results, options.maxResults ?? 20);
    return results;
  }

  format(results: RepoSearchResult[], query: string): string {
    return [
      "## Workspace Search",
      `- Query: ${query}`,
      "",
      ...(results.length
        ? results.flatMap((result) => [
            `- ${result.path}:${result.line}`,
            `  Snippet: ${result.snippet}`,
            `  Match: ${result.matchReason}`
          ])
        : ["- No matches found."])
    ].join("\n");
  }

  private async visit(
    repoRoot: string,
    dir: string,
    query: string,
    results: RepoSearchResult[],
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) return;
    const relativeDir = path.relative(repoRoot, dir);
    if (relativeDir && isIgnoredPath(relativeDir)) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries.sort(compareSearchEntries)) {
      if (results.length >= maxResults) return;
      const full = path.join(dir, entry.name);
      const relative = path.relative(repoRoot, full);
      if (!isInsideRepo(repoRoot, full) || isIgnoredPath(relative)) continue;
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        if (!REPO_IGNORED_DIRS.has(entry.name)) await this.visit(repoRoot, full, query, results, maxResults);
        continue;
      }
      if (!stat.isFile() || stat.size > REPO_MAX_FILE_BYTES || !this.isTextCandidate(relative)) continue;
      const buffer = await fs.readFile(full);
      if (isBinaryBuffer(buffer)) continue;
      const text = buffer.toString("utf8");
      const lines = text.split(/\r?\n/);
      const matchIndex = lines.findIndex((line) => line.toLowerCase().includes(query));
      if (matchIndex === -1) continue;
      results.push({
        path: relative,
        line: matchIndex + 1,
        snippet: lines[matchIndex]?.trim().slice(0, 240) ?? "",
        matchReason: "case-insensitive text match"
      });
    }
  }

  private isTextCandidate(relativePath: string): boolean {
    const base = path.basename(relativePath);
    if (base === "package.json" || base === "README.md" || base === "tsconfig.json") return true;
    return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
  }
}

function compareSearchEntries(a: Dirent, b: Dirent): number {
  const priority = (name: string) => {
    if (name === "src") return 0;
    if (name === "tests" || name === "test") return 1;
    if (name === "package.json" || name === "README.md" || name === "tsconfig.json") return 2;
    return 3;
  };
  return priority(a.name) - priority(b.name) || a.name.localeCompare(b.name);
}
