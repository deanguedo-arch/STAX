import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { isBinaryBuffer } from "./RepoSummary.js";
import {
  isBinaryExtension,
  isIgnoredRepoPath,
  normalizeRepoRelativePath,
  REPO_EVIDENCE_IGNORED_DIRS,
  REPO_EVIDENCE_MAX_FILE_BYTES,
  safeJoinRepoPath
} from "./RepoPathGuards.js";
import type { RepoRedaction, RepoSkippedPath } from "./RepoEvidenceSchemas.js";

export type SafeRepoText = {
  path: string;
  text?: string;
  skipped?: string;
  redaction?: RepoRedaction;
};

export type RepoTreeList = {
  files: string[];
  skipped: RepoSkippedPath[];
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
  ".yaml",
  ".toml",
  ".mjs",
  ".cjs"
]);

export class RepoSafeFileReader {
  constructor(private repoRoot: string) {}

  async readText(relativePath: string): Promise<SafeRepoText | undefined> {
    const normalized = normalizeRepoRelativePath(relativePath);
    const joined = safeJoinRepoPath(this.repoRoot, normalized);
    if (joined.skipped) return { path: normalized, skipped: joined.skipped };
    try {
      const stat = await fs.lstat(joined.path!);
      if (stat.isSymbolicLink()) return { path: normalized, skipped: "symlink" };
      if (!stat.isFile()) return undefined;
      if (stat.size > REPO_EVIDENCE_MAX_FILE_BYTES) return { path: normalized, skipped: "too large" };
      if (isBinaryExtension(normalized) || !isTextCandidate(normalized)) return { path: normalized, skipped: "non-text or binary extension" };
      const buffer = await fs.readFile(joined.path!);
      if (isBinaryBuffer(buffer)) return { path: normalized, skipped: "binary" };
      const redacted = redactSecrets(buffer.toString("utf8"));
      return {
        path: normalized,
        text: redacted.text,
        redaction: redacted.count ? { path: normalized, count: redacted.count, reason: "secret-like value redacted" } : undefined
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async listTree(relativeDir: string, maxDepth = 3): Promise<RepoTreeList> {
    const files: string[] = [];
    const skipped: RepoSkippedPath[] = [];
    const joined = safeJoinRepoPath(this.repoRoot, relativeDir);
    if (joined.skipped) return { files, skipped: [{ path: relativeDir, reason: joined.skipped }] };

    const visit = async (dir: string, depth: number): Promise<void> => {
      if (depth > maxDepth) return;
      const relative = path.relative(this.repoRoot, dir);
      if (relative && isIgnoredRepoPath(relative)) return;
      let entries: Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const entryRelative = normalizeRepoRelativePath(path.join(relative, entry.name));
        if (entry.name === ".DS_Store") {
          skipped.push({ path: entryRelative, reason: "system metadata" });
          continue;
        }
        if (isIgnoredRepoPath(entryRelative)) {
          skipped.push({ path: entryRelative, reason: "ignored or secret-like path" });
          continue;
        }
        const full = path.join(dir, entry.name);
        const stat = await fs.lstat(full);
        if (stat.isSymbolicLink()) {
          skipped.push({ path: entryRelative, reason: "symlink" });
          continue;
        }
        if (stat.isDirectory()) {
          if (!REPO_EVIDENCE_IGNORED_DIRS.has(entry.name)) await visit(full, depth + 1);
          continue;
        }
        if (stat.isFile()) {
          if (stat.size > REPO_EVIDENCE_MAX_FILE_BYTES) {
            skipped.push({ path: entryRelative, reason: "too large" });
            continue;
          }
          if (isBinaryExtension(entryRelative) || !isTextCandidate(entryRelative)) {
            skipped.push({ path: entryRelative, reason: "non-text or binary extension" });
            continue;
          }
          files.push(entryRelative);
        }
      }
    };

    await visit(joined.path!, 0);
    return { files: files.slice(0, 250), skipped };
  }

  async readRootConfigs(): Promise<SafeRepoText[]> {
    const entries = await fs.readdir(this.repoRoot).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    const candidates = entries.filter((entry) => ROOT_CONFIG_PATTERNS.some((pattern) => pattern.test(entry)));
    return (await Promise.all(candidates.map((entry) => this.readText(entry)))).filter(Boolean) as SafeRepoText[];
  }
}

const ROOT_CONFIG_PATTERNS = [
  /^package\.json$/,
  /^README\.md$/i,
  /^config\.json$/i,
  /^tsconfig\.json$/,
  /^vite\.config\.[cm]?[jt]s$/,
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.eslintrc(\..+)?$/,
  /^tailwind\.config\.[cm]?[jt]s$/,
  /^next\.config\.[cm]?[jt]s$/,
  /^playwright\.config\.[cm]?[jt]s$/
];

function isTextCandidate(relativePath: string): boolean {
  const base = path.basename(relativePath);
  if (ROOT_CONFIG_PATTERNS.some((pattern) => pattern.test(base))) return true;
  return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  const patterns = [
    /\b(sk-[A-Za-z0-9_-]{16,})\b/g,
    /\b(["']?(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*)(["']?)[^\s"',}]+\2/gi
  ];
  let redacted = text;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, (...args: string[]) => {
      count += 1;
      if (args.length > 3 && /[:=]/.test(args[1] ?? "")) return `${args[1]}[REDACTED]`;
      return "[REDACTED_SECRET]";
    });
  }
  return { text: redacted, count };
}
