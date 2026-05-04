import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SidecarGitSnapshot = {
  repoPath: string;
  repoName: string;
  branch?: string;
  commitSha?: string;
  gitStatusShort: string;
  diffStat: string;
  unifiedDiff: string;
};

export function sidecarDir(repoPath: string): string {
  return path.join(repoPath, ".stax");
}

export function normalizeRepoPath(repoPath: string): string {
  return path.resolve(repoPath);
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  if (await pathExists(filePath)) return;
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

export async function validateRepoPath(repoPath: string): Promise<string> {
  const resolved = normalizeRepoPath(repoPath);
  const stats = await fs.stat(resolved).catch(() => undefined);
  if (!stats?.isDirectory()) {
    throw new Error(`Repo path does not exist or is not a directory: ${resolved}`);
  }
  return resolved;
}

export async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
      maxBuffer: 20 * 1024 * 1024
    });
    return stdout.toString().trimEnd();
  } catch {
    return "";
  }
}

export async function collectGitSnapshot(repoPath: string): Promise<SidecarGitSnapshot> {
  const resolved = normalizeRepoPath(repoPath);
  const repoName = path.basename(resolved);
  const [branch, commitSha, gitStatusShort, diffStat, unifiedDiff] = await Promise.all([
    runGit(resolved, ["branch", "--show-current"]),
    runGit(resolved, ["rev-parse", "HEAD"]),
    runGit(resolved, ["status", "--short"]),
    runGit(resolved, ["diff", "--stat"]),
    runGit(resolved, ["diff", "--no-ext-diff", "--binary"])
  ]);
  return {
    repoPath: resolved,
    repoName,
    branch: branch || undefined,
    commitSha: commitSha || undefined,
    gitStatusShort,
    diffStat,
    unifiedDiff
  };
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function shortHash(input: string): string {
  return sha256(input).slice(0, 12);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sanitizeId(input: string): string {
  return input.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96) || "item";
}
