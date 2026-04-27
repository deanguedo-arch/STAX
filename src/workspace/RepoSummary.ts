import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

export const REPO_MAX_FILE_BYTES = 200 * 1024;
export const REPO_IGNORED_DIRS = new Set([
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

const BINARY_EXTENSIONS = new Set([
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

const SAFE_CONFIG_FILE_PATTERNS = [
  /^package\.json$/,
  /^README\.md$/i,
  /^tsconfig\.json$/,
  /^vite\.config\.[cm]?[jt]s$/,
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.eslintrc(\..+)?$/
];

export type SafeTextRead = {
  path: string;
  text?: string;
  skipped?: string;
};

export type RepoSummaryResult = {
  repoPath: string;
  markdown: string;
  safeFilesRead: string[];
  skipped: string[];
};

export class RepoSummary {
  constructor(private repoPath: string) {}

  async summarize(): Promise<RepoSummaryResult> {
    const repoRoot = await resolveRepoRoot(this.repoPath);
    const [packageJson, readme, tsconfig, configFiles, srcTree, testsTree] = await Promise.all([
      safeReadText(repoRoot, "package.json"),
      safeReadText(repoRoot, "README.md"),
      safeReadText(repoRoot, "tsconfig.json"),
      readConfigFiles(repoRoot),
      listTree(repoRoot, "src", 3),
      listTestTrees(repoRoot)
    ]);
    const reads = [packageJson, readme, tsconfig, ...configFiles].filter(Boolean) as SafeTextRead[];
    const safeFilesRead = [...new Set(reads.filter((item) => item.text !== undefined).map((item) => item.path))];
    const skipped = [
      ...reads.filter((item) => item.skipped).map((item) => `${item.path}: ${item.skipped}`),
      ...srcTree.skipped,
      ...testsTree.skipped
    ];
    const pkg = parsePackage(packageJson?.text);
    const stack = detectStack(pkg, tsconfig?.text, configFiles);
    const scripts = pkg?.scripts && typeof pkg.scripts === "object"
      ? Object.entries(pkg.scripts).map(([name, value]) => `- ${name}: ${String(value)}`)
      : ["- No package.json scripts detected."];
    const markdown = [
      "## Repo Summary",
      `- Repo: ${repoRoot}`,
      readme?.text ? `- README: ${compactLine(readme.text)}` : "- README: not found or skipped.",
      "",
      "## Detected Stack",
      ...stack.map((item) => `- ${item}`),
      "",
      "## Scripts",
      ...scripts,
      "",
      "## Key Files",
      ...safeFilesRead.map((file) => `- ${file}`),
      ...(srcTree.files.length ? srcTree.files.map((file) => `- ${file}`) : ["- No src tree found."]),
      "",
      "## Tests Found",
      ...(testsTree.files.length ? testsTree.files.map((file) => `- ${file}`) : ["- No tests tree found."]),
      "",
      "## Risks / Unknowns",
      ...(skipped.length ? skipped.slice(0, 20).map((item) => `- Skipped ${item}`) : ["- No skipped safe-summary files detected."])
    ].join("\n");

    return { repoPath: repoRoot, markdown, safeFilesRead, skipped };
  }
}

export async function resolveRepoRoot(repoPath: string): Promise<string> {
  const repoRoot = path.resolve(repoPath);
  const stat = await fs.stat(repoRoot);
  if (!stat.isDirectory()) throw new Error(`Linked repo path is not a directory: ${repoPath}`);
  return repoRoot;
}

export function isIgnoredPath(relativePath: string): boolean {
  const parts = relativePath.split(path.sep).filter(Boolean);
  return parts.some((part) => REPO_IGNORED_DIRS.has(part)) || parts.some(isSecretLikeFile);
}

export function isSecretLikeFile(fileName: string): boolean {
  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    /^secrets?\./i.test(fileName) ||
    /secret/i.test(fileName) ||
    /\.(pem|key|p12|crt)$/i.test(fileName)
  );
}

export async function safeReadText(repoRoot: string, relativePath: string): Promise<SafeTextRead | undefined> {
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized) || isIgnoredPath(normalized)) {
    return { path: normalized, skipped: "unsafe path" };
  }
  const fullPath = path.join(repoRoot, normalized);
  if (!isInsideRepo(repoRoot, fullPath)) return { path: normalized, skipped: "outside repo" };
  try {
    const stat = await fs.lstat(fullPath);
    if (stat.isSymbolicLink()) return { path: normalized, skipped: "symlink" };
    if (!stat.isFile()) return undefined;
    if (stat.size > REPO_MAX_FILE_BYTES) return { path: normalized, skipped: "too large" };
    if (BINARY_EXTENSIONS.has(path.extname(normalized).toLowerCase())) return { path: normalized, skipped: "binary extension" };
    const buffer = await fs.readFile(fullPath);
    if (isBinaryBuffer(buffer)) return { path: normalized, skipped: "binary" };
    return { path: normalized, text: buffer.toString("utf8") };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function isInsideRepo(repoRoot: string, fullPath: string): boolean {
  const root = path.resolve(repoRoot);
  const target = path.resolve(fullPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function isBinaryBuffer(buffer: Buffer): boolean {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let control = 0;
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) control += 1;
  }
  return sample.length > 0 && control / sample.length > 0.1;
}

export async function listTree(repoRoot: string, relativeDir: string, maxDepth: number): Promise<{ files: string[]; skipped: string[] }> {
  const files: string[] = [];
  const skipped: string[] = [];
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    const relative = path.relative(repoRoot, dir);
    if (relative && isIgnoredPath(relative)) return;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryRelative = path.join(relative, entry.name);
      if (isIgnoredPath(entryRelative)) {
        skipped.push(`${entryRelative}: ignored`);
        continue;
      }
      const full = path.join(dir, entry.name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) {
        skipped.push(`${entryRelative}: symlink`);
        continue;
      }
      if (stat.isDirectory()) {
        if (REPO_IGNORED_DIRS.has(entry.name)) continue;
        await visit(full, depth + 1);
        continue;
      }
      if (stat.isFile()) files.push(entryRelative);
    }
  }
  await visit(path.join(repoRoot, relativeDir), 0);
  return { files: files.slice(0, 200), skipped };
}

async function readConfigFiles(repoRoot: string): Promise<SafeTextRead[]> {
  const entries = await fs.readdir(repoRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const configFiles = entries.filter((entry) => SAFE_CONFIG_FILE_PATTERNS.some((pattern) => pattern.test(entry)));
  return (await Promise.all(configFiles.map((entry) => safeReadText(repoRoot, entry)))).filter(Boolean) as SafeTextRead[];
}

async function listTestTrees(repoRoot: string): Promise<{ files: string[]; skipped: string[] }> {
  const [tests, test, scriptsTests, e2e] = await Promise.all([
    listTree(repoRoot, "tests", 3),
    listTree(repoRoot, "test", 3),
    listTree(repoRoot, path.join("scripts", "tests"), 3),
    listTree(repoRoot, "e2e", 4)
  ]);
  return {
    files: [...tests.files, ...test.files, ...scriptsTests.files, ...e2e.files],
    skipped: [...tests.skipped, ...test.skipped, ...scriptsTests.skipped, ...e2e.skipped]
  };
}

function parsePackage(text?: string): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function detectStack(pkg: Record<string, unknown> | undefined, tsconfig?: string, configFiles: SafeTextRead[] = []): string[] {
  const deps = {
    ...(pkg?.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}),
    ...(pkg?.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {})
  } as Record<string, unknown>;
  const stack = new Set<string>();
  if (pkg) stack.add("Node/npm package");
  if (tsconfig || deps.typescript) stack.add("TypeScript");
  if (deps.vite || configFiles.some((file) => file.path.startsWith("vite.config."))) stack.add("Vite");
  if (deps.vitest) stack.add("Vitest");
  if (deps.eslint || configFiles.some((file) => /eslint|eslintrc/.test(file.path))) stack.add("ESLint");
  return stack.size ? Array.from(stack) : ["Unknown from safe summary files."];
}

function compactLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220) || "(empty)";
}
