import fs from "node:fs/promises";
import path from "node:path";
import { validateRepoPath } from "../sidecar/SidecarRepo.js";
import type { RepoDiscoveredFile, RepoDiscoveryResult, RepoPackageScript } from "./RepoDiscoverySchemas.js";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo", ".cache"]);
const ROOT_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "pyproject.toml",
  "requirements.txt",
  "Makefile",
  "justfile",
  "Taskfile.yml",
  "README.md",
  "AGENTS.md",
  "tsconfig.json",
  "vitest.config.ts",
  "vitest.config.js",
  "playwright.config.ts",
  "playwright.config.js",
  "vite.config.ts",
  "vite.config.js",
  "next.config.ts",
  "next.config.js"
];

export async function discoverRepo(repoPathInput: string): Promise<RepoDiscoveryResult> {
  const repoPath = await validateRepoPath(repoPathInput);
  const repoName = path.basename(repoPath);
  const files = await discoverFiles(repoPath);
  const packageScripts = await readPackageScripts(repoPath);
  return {
    schemaVersion: "stax-repo-discovery-v1",
    repoPath,
    repoName,
    packageScripts,
    files,
    warnings: []
  };
}

async function discoverFiles(repoPath: string): Promise<RepoDiscoveredFile[]> {
  const found = new Map<string, RepoDiscoveredFile>();
  const add = async (relativePath: string, kind: RepoDiscoveredFile["kind"], redacted = false): Promise<void> => {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (shouldSkipPath(normalized)) return;
    const fullPath = path.join(repoPath, normalized);
    const stats = await fs.stat(fullPath).catch(() => undefined);
    if (!stats?.isFile()) return;
    found.set(normalized, { path: normalized, kind, sizeBytes: stats.size, redacted });
  };

  for (const file of ROOT_FILES) {
    await add(file, kindForPath(file));
  }
  await addRootCommandFiles(repoPath, found);
  await addDirectory(repoPath, ".github/workflows", "workflow", found);
  await addDirectory(repoPath, "scripts", "script", found);
  await addDirectory(repoPath, "tools", "tool", found);
  await addDirectory(repoPath, "docs", "doc", found, 120);
  await addDirectory(repoPath, "config", "example_config", found, 80, (file) => file.endsWith(".example") || file.includes(".example."));

  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function addRootCommandFiles(repoPath: string, found: Map<string, RepoDiscoveredFile>): Promise<void> {
  const entries = await fs.readdir(repoPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) continue;
    if (!/\.(?:cmd|bat|ps1|sh)$/i.test(entry.name)) continue;
    const normalized = entry.name.replace(/\\/g, "/");
    if (shouldSkipPath(normalized)) continue;
    const fullPath = path.join(repoPath, normalized);
    const stats = await fs.stat(fullPath).catch(() => undefined);
    if (!stats?.isFile()) continue;
    found.set(normalized, {
      path: normalized,
      kind: "script",
      sizeBytes: stats.size,
      redacted: isSensitivePath(normalized)
    });
  }
}

async function addDirectory(
  repoPath: string,
  relativeDir: string,
  kind: RepoDiscoveredFile["kind"],
  found: Map<string, RepoDiscoveredFile>,
  maxFiles = 200,
  include: (relativePath: string) => boolean = () => true
): Promise<void> {
  const root = path.join(repoPath, relativeDir);
  const stats = await fs.stat(root).catch(() => undefined);
  if (!stats?.isDirectory()) return;
  const queue = [root];
  let count = 0;
  while (queue.length > 0 && count < maxFiles) {
    const dir = queue.shift() as string;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath).replace(/\\/g, "/");
      if (shouldSkipPath(relativePath)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) queue.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !include(relativePath)) continue;
      const stats = await fs.stat(fullPath).catch(() => undefined);
      if (!stats?.isFile()) continue;
      found.set(relativePath, {
        path: relativePath,
        kind,
        sizeBytes: stats.size,
        redacted: isSensitivePath(relativePath)
      });
      count += 1;
      if (count >= maxFiles) break;
    }
  }
}

async function readPackageScripts(repoPath: string): Promise<RepoPackageScript[]> {
  const packagePath = path.join(repoPath, "package.json");
  const raw = await fs.readFile(packagePath, "utf8").catch(() => "");
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> };
  return Object.entries(parsed.scripts ?? {})
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, command]) => ({ name, command, source: "package.json" as const }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function kindForPath(relativePath: string): RepoDiscoveredFile["kind"] {
  if (relativePath === "package.json") return "package_json";
  if (/lock\.yaml$|lock\.json$|yarn\.lock$/i.test(relativePath)) return "lockfile";
  if (/\.example(?:\.|$)|\.env\.example$/i.test(relativePath)) return "example_config";
  if (/config|tsconfig|vite\.config|next\.config|playwright\.config|vitest\.config/i.test(relativePath)) return "config";
  if (/readme|agents|docs\//i.test(relativePath)) return "doc";
  return "other";
}

function shouldSkipPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized.split("/").some((part) => SKIP_DIRS.has(part)) || isSensitivePath(normalized) || isLargeBinaryPath(normalized);
}

function isSensitivePath(relativePath: string): boolean {
  return /(^|\/)\.env(?:\.|$)|secret|token|credential|private-key|private_key/i.test(relativePath);
}

function isLargeBinaryPath(relativePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|pdf|docx|pptx|zip|tar|gz|mp4|mov|sqlite|db)$/i.test(relativePath);
}
