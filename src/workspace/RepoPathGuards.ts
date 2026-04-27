import fs from "node:fs/promises";
import path from "node:path";

export const REPO_EVIDENCE_MAX_FILE_BYTES = 200 * 1024;

export const REPO_EVIDENCE_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  "vendor",
  ".cache",
  "tmp"
]);

export const REPO_EVIDENCE_BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".tar",
  ".mp4",
  ".mov",
  ".sqlite",
  ".db",
  ".exe",
  ".dll"
]);

export async function resolveEvidenceRepoRoot(repoPath: string): Promise<string> {
  const repoRoot = path.resolve(repoPath);
  const stat = await fs.stat(repoRoot);
  if (!stat.isDirectory()) throw new Error(`Linked repo path is not a directory: ${repoPath}`);
  return repoRoot;
}

export function normalizeRepoRelativePath(relativePath: string): string {
  return path.normalize(relativePath).replace(/^(\.\/)+/, "");
}

export function isInsideRepoRoot(repoRoot: string, fullPath: string): boolean {
  const root = path.resolve(repoRoot);
  const target = path.resolve(fullPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function safeJoinRepoPath(repoRoot: string, relativePath: string): { path?: string; skipped?: string } {
  const normalized = normalizeRepoRelativePath(relativePath);
  if (!normalized || normalized === ".") return { path: repoRoot };
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return { skipped: "outside repo" };
  if (isIgnoredRepoPath(normalized)) return { skipped: "ignored or secret-like path" };
  const fullPath = path.join(repoRoot, normalized);
  if (!isInsideRepoRoot(repoRoot, fullPath)) return { skipped: "outside repo" };
  return { path: fullPath };
}

export function isIgnoredRepoPath(relativePath: string): boolean {
  const normalized = normalizeRepoRelativePath(relativePath);
  const parts = normalized.split(path.sep).filter(Boolean);
  return parts.some((part) => REPO_EVIDENCE_IGNORED_DIRS.has(part)) || parts.some(isSecretLikeRepoPath);
}

export function isSecretLikeRepoPath(fileName: string): boolean {
  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    /^secrets?(\.|$)/i.test(fileName) ||
    /secret/i.test(fileName) ||
    /\.(pem|key|p12|crt)$/i.test(fileName)
  );
}

export function isBinaryExtension(relativePath: string): boolean {
  return REPO_EVIDENCE_BINARY_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}
