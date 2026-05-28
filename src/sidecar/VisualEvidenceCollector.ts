import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectControlVisualEvidence } from "../projectControl/ProjectControlEvidencePacket.js";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  readTextIfExists,
  sanitizeId,
  shortHash,
  sidecarDir,
  validateRepoPath
} from "./SidecarRepo.js";
import {
  collectWorktreeFingerprint,
  type WorktreeFingerprint
} from "./WorktreeFingerprint.js";

export const VISUAL_PROOF_MANIFEST_SCHEMA_VERSION = "stax-visual-proof-manifest-v1";
export const VISUAL_PROOF_COLLECTOR_VERSION = "stax-sidecar-visual-proof-v1";

export type VisualProofSource = "rendered_screenshot" | "manual_visual_checklist" | "playwright_trace";

export type VisualProofManifestEntry = ProjectControlVisualEvidence & {
  proofId: string;
  fileHash?: string;
  sizeBytes?: number;
  checklistItems: string[];
  url?: string;
  repo?: string;
  branch?: string;
  commitSha?: string;
  worktreeAfter?: Pick<WorktreeFingerprint, "fingerprintHash">;
  collectorVersion: typeof VISUAL_PROOF_COLLECTOR_VERSION;
};

export type VisualProofManifest = {
  schemaVersion: typeof VISUAL_PROOF_MANIFEST_SCHEMA_VERSION;
  proofs: VisualProofManifestEntry[];
};

export type VisualProofVerificationStatus =
  | "verified_current_visual_proof"
  | "stale_visual_proof"
  | "tampered_visual_proof"
  | "missing_visual_file"
  | "legacy_visual_proof";

export type VerifiedVisualEvidence = ProjectControlVisualEvidence & {
  proofId: string;
  checklistItems: string[];
  verificationStatus: VisualProofVerificationStatus;
  verificationIssues: string[];
};

export type CollectVisualEvidenceOptions = {
  repoPath: string;
  description: string;
  checklistItems?: string[];
  source?: VisualProofSource;
  screenshotPath?: string;
  url?: string;
  outputName?: string;
  viewport?: string;
  now?: Date;
};

export type CollectVisualEvidenceResult = {
  repoPath: string;
  proofId: string;
  proofPath: string;
  manifestPath: string;
  fileHash?: string;
};

export async function collectVisualEvidence(
  options: CollectVisualEvidenceOptions
): Promise<CollectVisualEvidenceResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  if (!options.description.trim()) throw new Error("--description is required for visual evidence.");
  if (!options.screenshotPath && !options.url) {
    throw new Error("Provide either --path <screenshot> to register or --url <url> to capture.");
  }

  const staxPath = sidecarDir(repoPath);
  const visualDir = path.join(staxPath, "visual-proofs");
  await ensureDirectory(visualDir);

  const capturedAt = (options.now ?? new Date()).toISOString();
  const source = options.source ?? "rendered_screenshot";
  const proofId = `visual_${capturedAt.replace(/[:.]/g, "_")}_${shortHash(`${options.description}:${options.url ?? options.screenshotPath ?? ""}`)}`;
  const outputName = sanitizeVisualOutputName(options.outputName ?? `${proofId}${source === "playwright_trace" ? ".zip" : ".png"}`);
  const proofPath = path.join(visualDir, outputName);

  if (options.url) {
    await captureScreenshotWithPlaywright({
      repoPath,
      url: options.url,
      outputPath: proofPath,
      viewport: options.viewport
    });
  } else if (options.screenshotPath) {
    const inputPath = path.resolve(repoPath, options.screenshotPath);
    const outputResolved = path.resolve(proofPath);
    if (inputPath !== outputResolved) {
      await fs.copyFile(inputPath, outputResolved);
    }
  }

  const snapshot = await collectGitSnapshot(repoPath);
  const worktreeAfter = await collectWorktreeFingerprint(repoPath);
  const stat = await fs.stat(proofPath).catch(() => undefined);
  if (!stat?.isFile()) throw new Error(`Visual proof file was not created: ${proofPath}`);
  const fileHash = await hashFile(proofPath);
  const relativeProofPath = path.relative(repoPath, proofPath).replace(/\\/g, "/");
  const entry: VisualProofManifestEntry = {
    proofId,
    path: relativeProofPath,
    description: options.description.trim(),
    capturedAt,
    source,
    fileHash,
    sizeBytes: stat.size,
    checklistItems: options.checklistItems ?? [],
    url: options.url,
    repo: snapshot.repoName,
    branch: snapshot.branch,
    commitSha: snapshot.commitSha,
    worktreeAfter: {
      fingerprintHash: worktreeAfter.fingerprintHash
    },
    collectorVersion: VISUAL_PROOF_COLLECTOR_VERSION
  };
  await appendVisualProofManifestEntry(repoPath, entry);
  const manifestPath = visualProofManifestPath(repoPath);
  return {
    repoPath,
    proofId,
    proofPath: relativeProofPath,
    manifestPath: path.relative(repoPath, manifestPath).replace(/\\/g, "/"),
    fileHash
  };
}

async function appendVisualProofManifestEntry(repoPath: string, entry: VisualProofManifestEntry): Promise<void> {
  const visualDir = path.join(sidecarDir(repoPath), "visual-proofs");
  await ensureDirectory(visualDir);
  await withVisualManifestLock(visualDir, async () => {
    const manifestPath = visualProofManifestPath(repoPath);
    const manifest = await readVisualProofManifest(repoPath);
    const nextManifest: VisualProofManifest = {
      schemaVersion: VISUAL_PROOF_MANIFEST_SCHEMA_VERSION,
      proofs: [...manifest.proofs.filter((item) => item.proofId !== entry.proofId), entry]
    };
    const tempPath = path.join(visualDir, `.manifest.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tempPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, manifestPath);
  });
}

export async function readVisualEvidenceForGate(
  repoPathInput: string,
  currentFingerprint: WorktreeFingerprint
): Promise<VerifiedVisualEvidence[]> {
  const repoPath = await validateRepoPath(repoPathInput);
  const manifest = await readVisualProofManifest(repoPath);
  const evidence: VerifiedVisualEvidence[] = [];
  for (const proof of manifest.proofs) {
    const issues: string[] = [];
    const proofPath = proof.path ? path.resolve(repoPath, proof.path) : undefined;
    let status: VisualProofVerificationStatus = "verified_current_visual_proof";
    if (!proof.worktreeAfter?.fingerprintHash) {
      status = "legacy_visual_proof";
      issues.push("Visual proof has no worktree fingerprint.");
    } else if (proof.worktreeAfter.fingerprintHash !== currentFingerprint.fingerprintHash) {
      status = "stale_visual_proof";
      issues.push("Visual proof was captured for a different auditable worktree.");
    }
    if (!proofPath) {
      status = "missing_visual_file";
      issues.push("Visual proof has no file path.");
    } else {
      const exists = await fs.stat(proofPath).catch(() => undefined);
      if (!exists?.isFile()) {
        status = "missing_visual_file";
        issues.push("Visual proof file is missing.");
      } else if (proof.fileHash) {
        const actualHash = await hashFile(proofPath);
        if (actualHash !== proof.fileHash) {
          status = "tampered_visual_proof";
          issues.push("Visual proof file hash does not match the manifest.");
        }
      }
    }
    evidence.push({
      path: proof.path,
      description: visualDescriptionForGate(proof),
      capturedAt: proof.capturedAt,
      source: proof.source,
      proofId: proof.proofId,
      checklistItems: proof.checklistItems ?? [],
      verificationStatus: status,
      verificationIssues: issues
    });
  }
  return evidence;
}

export async function readVisualProofManifest(repoPathInput: string): Promise<VisualProofManifest> {
  const repoPath = await validateRepoPath(repoPathInput);
  const raw = await readTextIfExists(visualProofManifestPath(repoPath));
  if (!raw.trim()) return { schemaVersion: VISUAL_PROOF_MANIFEST_SCHEMA_VERSION, proofs: [] };
  try {
    return normalizeVisualProofManifest(JSON.parse(raw) as Partial<VisualProofManifest>);
  } catch {
    const recovered = recoverManifestWithTrailingData(raw);
    return recovered ? normalizeVisualProofManifest(recovered) : { schemaVersion: VISUAL_PROOF_MANIFEST_SCHEMA_VERSION, proofs: [] };
  }
}

function normalizeVisualProofManifest(parsed: Partial<VisualProofManifest>): VisualProofManifest {
  if (parsed.schemaVersion !== VISUAL_PROOF_MANIFEST_SCHEMA_VERSION || !Array.isArray(parsed.proofs)) {
    return { schemaVersion: VISUAL_PROOF_MANIFEST_SCHEMA_VERSION, proofs: [] };
  }
  return {
    schemaVersion: VISUAL_PROOF_MANIFEST_SCHEMA_VERSION,
    proofs: parsed.proofs
      .filter((item): item is VisualProofManifestEntry => Boolean(item?.proofId && item.description))
      .map((item) => ({
        ...item,
        source: item.source ?? "rendered_screenshot",
        checklistItems: Array.isArray(item.checklistItems) ? item.checklistItems : []
      }))
  };
}

function recoverManifestWithTrailingData(raw: string): Partial<VisualProofManifest> | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(0, index + 1)) as Partial<VisualProofManifest>;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

export function visualProofManifestPath(repoPath: string): string {
  return path.join(sidecarDir(repoPath), "visual-proofs", "manifest.json");
}

async function withVisualManifestLock<T>(visualDir: string, callback: () => Promise<T>): Promise<T> {
  const lockPath = path.join(visualDir, "manifest.lock");
  const startedAt = Date.now();
  while (true) {
    let handle: fs.FileHandle | undefined;
    try {
      handle = await fs.open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: nowIso() }));
      try {
        return await callback();
      } finally {
        await handle.close().catch(() => undefined);
        await fs.unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      await handle?.close().catch(() => undefined);
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      if (Date.now() - startedAt > 5000) {
        await fs.unlink(lockPath).catch(() => undefined);
      }
      await sleep(25);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshotWithPlaywright(input: {
  repoPath: string;
  url: string;
  outputPath: string;
  viewport?: string;
}): Promise<void> {
  const args = ["--no-install", "playwright", "screenshot"];
  if (input.viewport) args.push("--viewport-size", input.viewport);
  args.push(input.url, input.outputPath);
  try {
    await runProcess("npx", args, input.repoPath);
  } catch (error) {
    throw new Error(visualUrlCaptureFailureMessage({ ...input, cause: error }));
  }
}

export function visualUrlCaptureFailureMessage(input: {
  repoPath: string;
  url: string;
  viewport?: string;
  cause?: unknown;
}): string {
  const cause = input.cause instanceof Error ? input.cause.message : String(input.cause ?? "unknown error");
  return [
    `Unable to capture visual proof from --url ${input.url}.`,
    "URL capture requires repo-local Playwright because STAX runs `npx --no-install playwright screenshot` in the target repo.",
    `Target repo: ${input.repoPath}`,
    input.viewport ? `Viewport: ${input.viewport}` : undefined,
    `Fallback: take or export a screenshot manually, save it in the target repo, then run npm run stax:collect-visual -- --repo ${input.repoPath} --path <screenshot.png> --description "<page/state verified>" --checklist "<visible outcome>".`,
    `Original error: ${cause}`
  ].filter(Boolean).join(" ");
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const resolvedCommand = resolveSpawnCommand(command, args);
    const child = spawn(resolvedCommand.executable, resolvedCommand.args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${resolvedCommand.executable} ${resolvedCommand.args.join(" ")} exited ${code ?? "unknown"}`));
    });
  });
}

export function resolveSpawnCommand(
  command: string,
  args: string[],
  options: {
    platform?: NodeJS.Platform;
    execPath?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): { executable: string; args: string[] } {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") return { executable: command, args };
  if (!/^(npm|npx)$/i.test(command)) return { executable: command, args };

  const env = options.env ?? process.env;
  const execPath = options.execPath ?? process.execPath;
  const npmExecPath = env.npm_execpath?.trim();
  const platformPath = platform === "win32" ? path.win32 : path;
  const cliPath = command.toLowerCase() === "npm"
    ? npmExecPath
    : npmExecPath
      ? platformPath.join(platformPath.dirname(npmExecPath), "npx-cli.js")
      : platformPath.join(platformPath.dirname(execPath), "node_modules", "npm", "bin", "npx-cli.js");

  if (cliPath) return { executable: execPath, args: [cliPath, ...args] };
  return { executable: `${command}.cmd`, args };
}

async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function sanitizeVisualOutputName(input: string): string {
  const parsed = path.parse(input);
  const ext = parsed.ext || ".png";
  return `${sanitizeId(parsed.name)}${ext.toLowerCase()}`;
}

function visualDescriptionForGate(proof: VisualProofManifestEntry): string {
  const checklistItems = Array.isArray(proof.checklistItems) ? proof.checklistItems : [];
  const checklist = checklistItems.length > 0
    ? ` Checklist: ${checklistItems.join(", ")}.`
    : "";
  const source = proof.path ? ` Artifact: ${proof.path}.` : "";
  const url = proof.url ? ` URL: ${proof.url}.` : "";
  return `${proof.description}${checklist}${source}${url}`.trim();
}
