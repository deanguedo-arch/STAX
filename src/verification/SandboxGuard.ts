import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  SandboxGuardInputSchema,
  SandboxGuardResultSchema,
  SandboxManifestSchema,
  type SandboxGuardInput,
  type SandboxGuardResult,
  type SandboxManifestFile,
  type SandboxManifest
} from "./SandboxGuardSchemas.js";

const MANIFEST_FILE = ".stax-sandbox.json";

export class SandboxGuard {
  async create(input: SandboxGuardInput): Promise<SandboxGuardResult> {
    const parsed = SandboxGuardInputSchema.parse(input);
    if (!parsed.humanApprovedSandbox) {
      return guardResult({
        status: "approval_required",
        sandboxPath: parsed.sandboxPath,
        sourceRepoPath: parsed.sourceRepoPath,
        blockingReasons: ["Human approval is required before sandbox creation."],
        summary: "Sandbox was not created because approval is missing."
      });
    }
    const guard = await this.guardPaths(parsed);
    if (guard) return guard;

    const sourceRepoPath = path.resolve(parsed.sourceRepoPath!);
    const sandboxPath = path.resolve(parsed.sandboxPath);
    const existing = await existingTargetState(sandboxPath);
    if (existing === "has_manifest") {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        manifestPath: manifestPath(sandboxPath),
        blockingReasons: ["Sandbox target already has a STAX manifest; verify it or choose a new empty sandbox path."],
        summary: "Sandbox creation refused to merge-copy into an existing STAX sandbox."
      });
    }
    if (existing === "nonempty_without_manifest") {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        blockingReasons: ["Sandbox target already exists and is not an empty STAX sandbox."],
        summary: "Sandbox creation refused to overwrite a non-empty directory without a STAX sandbox manifest."
      });
    }

    await fs.mkdir(sandboxPath, { recursive: true });
    const copied = await copyDirectory(sourceRepoPath, sandboxPath);
    const fileManifest = await buildFileManifest(sandboxPath);
    const manifest = SandboxManifestSchema.parse({
      sandboxId: `sandbox-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17)}-${crypto.randomBytes(3).toString("hex")}`,
      workspace: parsed.workspace,
      packetId: parsed.packetId,
      sourceRepoPath,
      sandboxPath,
      createdAt: new Date().toISOString(),
      copiedFiles: copied.copiedFiles,
      skippedEntries: copied.skippedEntries,
      fileManifest,
      patchHistory: [],
      guardVersion: "v0D"
    });
    await fs.writeFile(manifestPath(sandboxPath), JSON.stringify(manifest, null, 2), "utf8");
    return guardResult({
      status: "created",
      allowedForCommandWindow: true,
      sandboxPath,
      sourceRepoPath,
      manifestPath: manifestPath(sandboxPath),
      copiedFiles: copied.copiedFiles,
      skippedEntries: copied.skippedEntries,
      integrityFileCount: fileManifest.length,
      summary: "Sandbox copy created and manifest recorded."
    });
  }

  async verify(input: Omit<SandboxGuardInput, "humanApprovedSandbox">): Promise<SandboxGuardResult> {
    const parsed = SandboxGuardInputSchema.parse({ ...input, humanApprovedSandbox: true });
    const guard = await this.guardPaths(parsed);
    if (guard) return guard;
    const sourceRepoPath = path.resolve(parsed.sourceRepoPath!);
    const sandboxPath = path.resolve(parsed.sandboxPath);
    let manifest: SandboxManifest;
    try {
      manifest = SandboxManifestSchema.parse(JSON.parse(await fs.readFile(manifestPath(sandboxPath), "utf8")));
    } catch {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        blockingReasons: ["Sandbox manifest is missing or invalid."],
        summary: "Sandbox verification failed because .stax-sandbox.json was not valid."
      });
    }
    const blockingReasons: string[] = [];
    blockingReasons.push(...manifestMetadataFailures({ manifest, parsed, sourceRepoPath, sandboxPath }));
    const integrityFailures = await verifyFileManifest(sandboxPath, manifest).catch((error) => [
      `Sandbox integrity verification failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`
    ]);
    blockingReasons.push(...integrityFailures);
    if (blockingReasons.length) {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        manifestPath: manifestPath(sandboxPath),
        copiedFiles: manifest.copiedFiles,
        skippedEntries: manifest.skippedEntries,
        integrityFileCount: manifest.fileManifest?.length ?? 0,
        blockingReasons,
        summary: "Sandbox verification failed."
      });
    }
    return guardResult({
      status: "verified",
      allowedForCommandWindow: true,
      sandboxPath,
      sourceRepoPath,
      manifestPath: manifestPath(sandboxPath),
      copiedFiles: manifest.copiedFiles,
      skippedEntries: manifest.skippedEntries,
      integrityFileCount: manifest.fileManifest?.length ?? 0,
      summary: "Sandbox manifest and file integrity verified; command window may use this sandbox path."
    });
  }

  async refreshIntegrityAfterPatch(input: Omit<SandboxGuardInput, "humanApprovedSandbox"> & {
    patchEvidenceId: string;
    changedFiles: string[];
    diffPath?: string;
  }): Promise<SandboxGuardResult> {
    const parsed = SandboxGuardInputSchema.parse({ ...input, humanApprovedSandbox: true });
    const guard = await this.guardPaths(parsed);
    if (guard) return guard;
    const sourceRepoPath = path.resolve(parsed.sourceRepoPath!);
    const sandboxPath = path.resolve(parsed.sandboxPath);
    let manifest: SandboxManifest;
    try {
      manifest = SandboxManifestSchema.parse(JSON.parse(await fs.readFile(manifestPath(sandboxPath), "utf8")));
    } catch {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        blockingReasons: ["Sandbox manifest is missing or invalid."],
        summary: "Sandbox integrity refresh failed because .stax-sandbox.json was not valid."
      });
    }

    const blockingReasons = manifestMetadataFailures({ manifest, parsed, sourceRepoPath, sandboxPath });
    if (manifest.guardVersion !== "v0D" || !manifest.fileManifest) {
      blockingReasons.push("Sandbox manifest lacks v0D file integrity hashes; recreate the sandbox before patching.");
    }
    if (blockingReasons.length) {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        manifestPath: manifestPath(sandboxPath),
        copiedFiles: manifest.copiedFiles,
        skippedEntries: manifest.skippedEntries,
        integrityFileCount: manifest.fileManifest?.length ?? 0,
        blockingReasons,
        summary: "Sandbox integrity refresh failed."
      });
    }

    const fileManifest = await buildFileManifest(sandboxPath);
    const updated = SandboxManifestSchema.parse({
      ...manifest,
      fileManifest,
      patchHistory: [
        ...manifest.patchHistory,
        {
          patchEvidenceId: input.patchEvidenceId,
          createdAt: new Date().toISOString(),
          changedFiles: input.changedFiles,
          diffPath: input.diffPath
        }
      ],
      guardVersion: "v0D"
    });
    await fs.writeFile(manifestPath(sandboxPath), JSON.stringify(updated, null, 2), "utf8");
    return guardResult({
      status: "verified",
      allowedForCommandWindow: true,
      sandboxPath,
      sourceRepoPath,
      manifestPath: manifestPath(sandboxPath),
      copiedFiles: updated.copiedFiles,
      skippedEntries: updated.skippedEntries,
      integrityFileCount: updated.fileManifest?.length ?? 0,
      summary: "Sandbox integrity manifest refreshed after approved sandbox patch."
    });
  }

  private async guardPaths(input: ReturnType<typeof SandboxGuardInputSchema.parse>): Promise<SandboxGuardResult | undefined> {
    if (!input.sourceRepoPath) {
      return guardResult({
        status: "blocked",
        sandboxPath: input.sandboxPath,
        blockingReasons: ["Linked repo source path is required."],
        summary: "Sandbox guard cannot proceed without a linked repo source path."
      });
    }
    const sourceRepoPath = path.resolve(input.sourceRepoPath);
    const sandboxPath = path.resolve(input.sandboxPath);
    const sourceStat = await fs.stat(sourceRepoPath).catch(() => undefined);
    if (!sourceStat?.isDirectory()) {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        blockingReasons: ["Linked repo source path does not exist or is not a directory."],
        summary: "Sandbox guard cannot proceed without a real linked repo directory."
      });
    }
    if (samePath(sourceRepoPath, sandboxPath)) {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        blockingReasons: ["Sandbox path cannot equal linked repo path."],
        summary: "Sandbox guard refused to use the linked repo as a sandbox."
      });
    }
    if (isInside(sandboxPath, sourceRepoPath)) {
      return guardResult({
        status: "blocked",
        sandboxPath,
        sourceRepoPath,
        blockingReasons: ["Sandbox path cannot be inside the linked repo path."],
        summary: "Sandbox guard refused to create a sandbox inside the linked repo."
      });
    }
    return undefined;
  }
}

function manifestMetadataFailures(input: {
  manifest: SandboxManifest;
  parsed: ReturnType<typeof SandboxGuardInputSchema.parse>;
  sourceRepoPath: string;
  sandboxPath: string;
}): string[] {
  const blockingReasons: string[] = [];
  if (path.resolve(input.manifest.sourceRepoPath) !== input.sourceRepoPath) blockingReasons.push("Sandbox manifest sourceRepoPath does not match the linked repo.");
  if (path.resolve(input.manifest.sandboxPath) !== input.sandboxPath) blockingReasons.push("Sandbox manifest sandboxPath does not match the requested path.");
  if (input.manifest.packetId && input.parsed.packetId && input.manifest.packetId !== input.parsed.packetId) blockingReasons.push("Sandbox manifest packetId does not match the requested packet.");
  return blockingReasons;
}

function guardResult(input: Partial<SandboxGuardResult> & { status: SandboxGuardResult["status"]; sandboxPath: string; summary: string }): SandboxGuardResult {
  return SandboxGuardResultSchema.parse({
    allowedForCommandWindow: false,
    copiedFiles: 0,
    skippedEntries: [],
    integrityFileCount: 0,
    blockingReasons: [],
    ...input,
    sandboxPath: path.resolve(input.sandboxPath)
  });
}

async function copyDirectory(source: string, target: string): Promise<{ copiedFiles: number; skippedEntries: string[] }> {
  const skippedEntries: string[] = [];
  let copiedFiles = 0;
  async function walk(currentSource: string, currentTarget: string, relative = ""): Promise<void> {
    const entries = await fs.readdir(currentSource, { withFileTypes: true });
    await fs.mkdir(currentTarget, { recursive: true });
    for (const entry of entries) {
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (shouldSkip(nextRelative, entry)) {
        skippedEntries.push(nextRelative);
        continue;
      }
      const sourcePath = path.join(currentSource, entry.name);
      const targetPath = path.join(currentTarget, entry.name);
      if (entry.isDirectory()) {
        await walk(sourcePath, targetPath, nextRelative);
        continue;
      }
      if (entry.isFile()) {
        await fs.copyFile(sourcePath, targetPath);
        copiedFiles += 1;
        continue;
      }
      skippedEntries.push(nextRelative);
    }
  }
  await walk(source, target);
  return { copiedFiles, skippedEntries };
}

async function buildFileManifest(sandboxPath: string): Promise<SandboxManifestFile[]> {
  const files: SandboxManifestFile[] = [];
  async function walk(currentPath: string, relative = ""): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (nextRelative === MANIFEST_FILE) continue;
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (isAllowedGeneratedPath(nextRelative)) continue;
        await walk(absolutePath, nextRelative);
        continue;
      }
      if (!entry.isFile()) continue;
      const buffer = await fs.readFile(absolutePath);
      files.push({
        relativePath: nextRelative,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
        sizeBytes: buffer.byteLength
      });
    }
  }
  await walk(sandboxPath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function verifyFileManifest(sandboxPath: string, manifest: SandboxManifest): Promise<string[]> {
  if (manifest.guardVersion !== "v0D" || !manifest.fileManifest) {
    return ["Sandbox manifest lacks v0D file integrity hashes; recreate the sandbox before command execution."];
  }
  const failures: string[] = [];
  const expected = new Map(manifest.fileManifest.map((item) => [item.relativePath, item]));
  const seen = new Set<string>();

  for (const file of manifest.fileManifest) {
    if (!isSafeManifestRelativePath(file.relativePath)) {
      failures.push(`Sandbox manifest contains an unsafe relative file path: ${file.relativePath}.`);
      continue;
    }
    const absolutePath = path.join(sandboxPath, file.relativePath);
    const stat = await fs.lstat(absolutePath).catch(() => undefined);
    if (!stat) {
      failures.push(`Sandbox copied file is missing: ${file.relativePath}.`);
      continue;
    }
    if (stat.isSymbolicLink()) {
      failures.push(`Sandbox copied file became a symlink: ${file.relativePath}.`);
      continue;
    }
    if (!stat.isFile()) {
      failures.push(`Sandbox copied file is no longer a file: ${file.relativePath}.`);
      continue;
    }
    const buffer = await fs.readFile(absolutePath);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    if (sha256 !== file.sha256 || buffer.byteLength !== file.sizeBytes) {
      failures.push(`Sandbox copied file changed after creation: ${file.relativePath}.`);
    }
    seen.add(file.relativePath);
  }

  await scanCurrentSandbox(sandboxPath, async (relativePath, stat) => {
    if (relativePath === MANIFEST_FILE) return;
    if (stat.isSymbolicLink()) {
      if (isAllowedGeneratedPath(relativePath) && await symlinkStaysInsideSandbox(sandboxPath, relativePath)) return;
      failures.push(`Sandbox contains a symlink after creation: ${relativePath}.`);
      return;
    }
    if (expected.has(relativePath)) return;
    if (isAllowedGeneratedPath(relativePath)) return;
    if (stat.isFile()) failures.push(`Sandbox contains an unexpected file not present in the integrity manifest: ${relativePath}.`);
  });

  const missingSeen = manifest.fileManifest.filter((item) => !seen.has(item.relativePath));
  if (missingSeen.length && failures.length === 0) {
    failures.push("Sandbox integrity verification did not observe every manifest file.");
  }
  return failures;
}

async function scanCurrentSandbox(
  sandboxPath: string,
  onEntry: (relativePath: string, stat: Awaited<ReturnType<typeof fs.lstat>>) => Promise<void>
): Promise<void> {
  async function walk(currentPath: string, relative = ""): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const absolutePath = path.join(currentPath, entry.name);
      const stat = await fs.lstat(absolutePath);
      await onEntry(nextRelative, stat);
      if (stat.isDirectory()) {
        await walk(absolutePath, nextRelative);
      }
    }
  }
  await walk(sandboxPath);
}

function isAllowedGeneratedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return /^(node_modules|dist|build|coverage|runs|evidence|\.vite|\.turbo)(\/|$)/.test(normalized)
    || /\.tsbuildinfo$/i.test(normalized);
}

async function symlinkStaysInsideSandbox(sandboxPath: string, relativePath: string): Promise<boolean> {
  try {
    const sandboxRoot = await fs.realpath(sandboxPath);
    const resolved = await fs.realpath(path.join(sandboxPath, relativePath));
    const relative = path.relative(sandboxRoot, resolved);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function isSafeManifestRelativePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return !path.isAbsolute(relativePath)
    && normalized !== "."
    && normalized !== ".."
    && !normalized.startsWith("../")
    && !normalized.includes("/../")
    && !normalized.endsWith("/..");
}

function shouldSkip(relativePath: string, entry: { name: string; isSymbolicLink(): boolean; isDirectory(): boolean }): boolean {
  if (entry.isSymbolicLink()) return true;
  const normalized = relativePath.replace(/\\/g, "/");
  if (/^(node_modules|\.git|dist|build|coverage|runs|evidence)(\/|$)/.test(normalized)) return true;
  if (/^\.env(?:\.|$)/.test(entry.name)) return true;
  if (entry.name === ".npmrc") return true;
  if (/\.(pem|key|p12|pfx)$/i.test(entry.name)) return true;
  if (entry.name === ".DS_Store") return true;
  return false;
}

async function existingTargetState(sandboxPath: string): Promise<"missing" | "empty" | "has_manifest" | "nonempty_without_manifest"> {
  try {
    const entries = await fs.readdir(sandboxPath);
    if (entries.length === 0) return "empty";
    if (entries.includes(MANIFEST_FILE)) return "has_manifest";
    return "nonempty_without_manifest";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

function manifestPath(sandboxPath: string): string {
  return path.join(path.resolve(sandboxPath), MANIFEST_FILE);
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}
