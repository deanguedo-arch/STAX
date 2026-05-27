import fs from "node:fs/promises";
import path from "node:path";
import { classifyFileRole } from "../diffAudit/DiffAudit.js";
import { collectGitSnapshot, runGit, sha256 } from "./SidecarRepo.js";

export const WORKTREE_FINGERPRINT_SCHEMA_VERSION = "stax-worktree-fingerprint-v1" as const;

export type WorktreeFingerprintFile = {
  path: string;
  status: string;
  contentHash?: string;
};

export type WorktreeFingerprint = {
  schemaVersion: typeof WORKTREE_FINGERPRINT_SCHEMA_VERSION;
  repoPathHash: string;
  repoName: string;
  branch?: string;
  headSha?: string;
  statusPorcelainHash: string;
  diffBinaryHash: string;
  trackedChangedFiles: WorktreeFingerprintFile[];
  untrackedRelevantFiles: Array<{ path: string; contentHash: string }>;
  ignoredSidecarFiles: string[];
  fingerprintHash: string;
};

const UNTRACKED_RELEVANT_ROLES = new Set([
  "source",
  "test",
  "fixture",
  "config",
  "lockfile",
  "script",
  "migration",
  "visual_style"
]);

export async function collectWorktreeFingerprint(repoPath: string): Promise<WorktreeFingerprint> {
  const snapshot = await collectGitSnapshot(repoPath);
  const statusPorcelain = await runGit(repoPath, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const parsed = parsePorcelain(statusPorcelain);
  const trackedRelevant = parsed.filter((item) =>
    item.status !== "??" &&
    !isWorktreeFingerprintExcludedPath(item.path) &&
    !isGeneratedRuntimeArtifactPath(item.path)
  );
  const untrackedRelevant = parsed.filter((item) => {
    if (item.status !== "??") return false;
    return isAuditableUntrackedPath(item.path);
  });
  const ignoredRelevant = (await collectIgnoredRelevantFiles(repoPath))
    .filter((filePath) => !untrackedRelevant.some((item) => normalizeRelativePath(item.path) === filePath));
  const ignoredSidecarFiles = parsed
    .filter((item) => isWorktreeFingerprintExcludedPath(item.path))
    .map((item) => item.path)
    .sort(comparePaths);
  const trackedChangedFiles = await Promise.all(
    trackedRelevant
      .map((item) => ({ path: normalizeRelativePath(item.path), status: item.status.trim() || "modified" }))
      .sort((a, b) => comparePaths(a.path, b.path))
      .map(async (item) => ({
        ...item,
        contentHash: await contentHashIfPresent(repoPath, item.path)
      }))
  );
  const untrackedRelevantFiles = await Promise.all(
    [
      ...untrackedRelevant.map((item) => normalizeRelativePath(item.path)),
      ...ignoredRelevant
    ]
      .filter(uniquePathFilter())
      .sort(comparePaths)
      .map(async (filePath) => ({
        path: filePath,
        contentHash: await contentHashRequired(repoPath, filePath)
      }))
  );
  const trackedPaths = trackedChangedFiles.map((item) => item.path);
  const diffBinary = trackedPaths.length > 0
    ? await runGit(repoPath, ["diff", "--binary", "--no-ext-diff", "--", ...trackedPaths])
    : "";
  const statusPorcelainHash = stableHash(
    trackedRelevant
      .map((item) => ({ path: normalizeRelativePath(item.path), status: item.status }))
      .sort((a, b) => comparePaths(a.path, b.path))
  );
  const diffBinaryHash = sha256(diffBinary);
  const fingerprintBase = {
    schemaVersion: WORKTREE_FINGERPRINT_SCHEMA_VERSION,
    repoPathHash: sha256(path.resolve(repoPath)),
    repoName: snapshot.repoName,
    branch: snapshot.branch,
    statusPorcelainHash,
    diffBinaryHash,
    trackedChangedFiles,
    untrackedRelevantFiles
  };
  return {
    ...fingerprintBase,
    headSha: snapshot.commitSha,
    ignoredSidecarFiles,
    fingerprintHash: stableHash(fingerprintBase)
  };
}

export function stableHash(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function isWorktreeFingerprintExcludedPath(filePath: string): boolean {
  const normalized = normalizeRelativePath(filePath);
  if (!normalized.startsWith(".stax/")) return false;
  if (/^\.stax\/command-evidence\/[^/]+\.json$/i.test(normalized)) return false;
  if (/^\.stax\/command-evidence\/[^/]+\.pointer\.json$/i.test(normalized)) return true;
  return normalized === ".stax/config.json" ||
    normalized === ".stax/current-turn.json" ||
    normalized === ".stax/codex-report.md" ||
    normalized === ".stax/heartbeat.json" ||
    normalized === ".stax/next-codex-prompt.md" ||
    normalized === ".stax/proof_strength.json" ||
    normalized === ".stax/status.md" ||
    normalized === ".stax/status.json" ||
    normalized === ".stax/task.md" ||
    normalized === ".stax/turn-contract.json" ||
    normalized === ".stax/ledger.json" ||
    normalized === ".stax/learning-ledger.json" ||
    normalized.startsWith(".stax/events/") ||
    normalized.startsWith(".stax/reports/") ||
    normalized.startsWith(".stax/runtime/") ||
    normalized.startsWith(".stax/turns/");
}

async function collectIgnoredRelevantFiles(repoPath: string): Promise<string[]> {
  const ignored = await runGit(repoPath, ["ls-files", "--others", "--ignored", "--exclude-standard"]);
  return ignored
    .split(/\r?\n/)
    .map((line) => normalizeRelativePath(line.trim()))
    .filter(Boolean)
    .filter(isAuditableUntrackedPath)
    .sort(comparePaths);
}

function isAuditableUntrackedPath(filePath: string): boolean {
  const normalized = normalizeRelativePath(filePath);
  if (isWorktreeFingerprintExcludedPath(normalized)) return false;
  if (isDependencyTreePath(normalized)) return false;
  if (isGeneratedOutputPath(normalized)) return false;
  if (normalized === ".gitignore" || normalized === "AGENTS.md") return true;
  return UNTRACKED_RELEVANT_ROLES.has(classifyFileRole(normalized));
}

function isDependencyTreePath(filePath: string): boolean {
  const normalized = normalizeRelativePath(filePath);
  return normalized.startsWith("node_modules/") ||
    normalized.startsWith("bower_components/") ||
    normalized.startsWith(".pnpm-store/") ||
    normalized.startsWith(".yarn/cache/") ||
    normalized.startsWith(".yarn/unplugged/") ||
    normalized.startsWith(".venv/") ||
    normalized.startsWith("venv/") ||
    normalized.startsWith("vendor/bundle/");
}

function isGeneratedOutputPath(filePath: string): boolean {
  const normalized = normalizeRelativePath(filePath);
  return isGeneratedRuntimeArtifactPath(normalized) ||
    normalized.startsWith("dist/") ||
    normalized.startsWith("build/") ||
    normalized.startsWith("coverage/") ||
    normalized.startsWith("out/") ||
    normalized.startsWith("tmp/") ||
    normalized.startsWith("temp/") ||
    normalized.startsWith(".next/") ||
    /^projects\/[^/]+\/exports\//.test(normalized);
}

function isGeneratedRuntimeArtifactPath(filePath: string): boolean {
  const normalized = normalizeRelativePath(filePath);
  return normalized.includes("/__pycache__/") ||
    normalized.endsWith(".pyc") ||
    /^projects\/[^/]+\/meta\/visual-checks\//.test(normalized);
}

function uniquePathFilter(): (filePath: string) => boolean {
  const seen = new Set<string>();
  return (filePath) => {
    if (seen.has(filePath)) return false;
    seen.add(filePath);
    return true;
  };
}

function parsePorcelain(input: string): Array<{ status: string; path: string }> {
  return input
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      const rawPath = line.slice(3).trim();
      const renamedPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)?.trim() ?? rawPath : rawPath;
      return { status, path: normalizeRelativePath(unquotePorcelainPath(renamedPath)) };
    });
}

function unquotePorcelainPath(filePath: string): string {
  if (!filePath.startsWith("\"")) return filePath;
  try {
    return JSON.parse(filePath) as string;
  } catch {
    return filePath.replace(/^"|"$/g, "");
  }
}

async function contentHashIfPresent(repoPath: string, relativePath: string): Promise<string | undefined> {
  const fullPath = path.join(repoPath, relativePath);
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return undefined;
    return sha256((await fs.readFile(fullPath)).toString("base64"));
  } catch {
    return undefined;
  }
}

async function contentHashRequired(repoPath: string, relativePath: string): Promise<string> {
  return (await contentHashIfPresent(repoPath, relativePath)) ?? sha256("");
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function comparePaths(a: string, b: string): number {
  return a.localeCompare(b, "en");
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined) sorted[key] = sortJsonValue(child);
  }
  return sorted;
}
