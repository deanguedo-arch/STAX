import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  readTextIfExists,
  sanitizeId,
  sha256,
  sidecarDir
} from "./SidecarRepo.js";

export const STAX_EVIDENCE_ROOT_ENV = "STAX_EVIDENCE_ROOT";
export const EXTERNAL_COMMAND_EVIDENCE_STORE_SCHEMA_VERSION = "stax-external-command-evidence-store-v1" as const;
export const COMMAND_EVIDENCE_POINTER_SCHEMA_VERSION = "stax-command-evidence-pointer-v1" as const;

export type ExternalCommandEvidenceStore = {
  schemaVersion: typeof EXTERNAL_COMMAND_EVIDENCE_STORE_SCHEMA_VERSION;
  repoId: string;
  rootDir: string;
  repoStoreDir: string;
  commandEvidenceDir: string;
  metadataPath: string;
};

export type CommandEvidencePointer = {
  schemaVersion: typeof COMMAND_EVIDENCE_POINTER_SCHEMA_VERSION;
  evidenceId: string;
  repoId: string;
  externalStore: true;
  evidencePath: string;
  stdoutPath: string;
  stderrPath: string;
  ledgerPath: string;
  worktreeAfterHash: string;
  canonicalEvidenceHash: string;
  recordedAt: string;
  note: string;
};

export async function ensureExternalCommandEvidenceStore(repoPath: string): Promise<ExternalCommandEvidenceStore> {
  const store = externalCommandEvidenceStoreForRepo(repoPath);
  await ensureDirectory(store.commandEvidenceDir);
  await writeExternalCommandEvidenceMetadata(repoPath, store);
  return store;
}

export function externalCommandEvidenceStoreForRepo(repoPath: string): ExternalCommandEvidenceStore {
  const rootDir = externalEvidenceRoot();
  const repoId = externalCommandEvidenceRepoId(repoPath);
  const repoStoreDir = path.join(rootDir, repoId);
  const commandEvidenceDir = path.join(repoStoreDir, "command-evidence");
  return {
    schemaVersion: EXTERNAL_COMMAND_EVIDENCE_STORE_SCHEMA_VERSION,
    repoId,
    rootDir,
    repoStoreDir,
    commandEvidenceDir,
    metadataPath: path.join(repoStoreDir, "repo.json")
  };
}

export function externalEvidenceRoot(): string {
  const configured = process.env[STAX_EVIDENCE_ROOT_ENV]?.trim();
  if (configured) return path.resolve(expandHome(configured));
  return path.join(os.homedir(), ".stax", "evidence");
}

export function externalCommandEvidenceRepoId(repoPath: string): string {
  const resolved = path.resolve(repoPath);
  const repoName = sanitizeId(path.basename(resolved));
  return `${repoName}_${sha256(resolved).slice(0, 12)}`;
}

export function commandEvidencePointerPath(repoPath: string, evidenceId: string): string {
  return path.join(sidecarDir(repoPath), "command-evidence", `${evidenceId}.pointer.json`);
}

export async function writeCommandEvidencePointer(input: {
  repoPath: string;
  store: ExternalCommandEvidenceStore;
  evidenceId: string;
  evidencePath: string;
  stdoutPath: string;
  stderrPath: string;
  ledgerPath: string;
  worktreeAfterHash: string;
  canonicalEvidenceHash: string;
  recordedAt: string;
}): Promise<CommandEvidencePointer> {
  const pointer: CommandEvidencePointer = {
    schemaVersion: COMMAND_EVIDENCE_POINTER_SCHEMA_VERSION,
    evidenceId: input.evidenceId,
    repoId: input.store.repoId,
    externalStore: true,
    evidencePath: input.evidencePath,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    ledgerPath: input.ledgerPath,
    worktreeAfterHash: input.worktreeAfterHash,
    canonicalEvidenceHash: input.canonicalEvidenceHash,
    recordedAt: input.recordedAt,
    note: "Pointer only. STAX verifies command proof from the external evidence store, not from this repo-local file."
  };
  const pointerPath = commandEvidencePointerPath(input.repoPath, input.evidenceId);
  await ensureDirectory(path.dirname(pointerPath));
  await fs.writeFile(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  return pointer;
}

export function displayExternalEvidencePath(filePath: string): string {
  const home = os.homedir();
  const resolved = path.resolve(filePath);
  return resolved.startsWith(`${home}${path.sep}`) ? `~/${path.relative(home, resolved)}` : resolved;
}

async function writeExternalCommandEvidenceMetadata(
  repoPath: string,
  store: ExternalCommandEvidenceStore
): Promise<void> {
  const snapshot = await collectGitSnapshot(repoPath);
  const previousRaw = await readTextIfExists(store.metadataPath);
  const previous = previousRaw.trim() ? tryParseJson(previousRaw) : {};
  const createdAt = stringField(previous, "createdAt") ?? nowIso();
  const metadata = {
    schemaVersion: store.schemaVersion,
    repoId: store.repoId,
    repoName: snapshot.repoName,
    repoPathHash: sha256(path.resolve(repoPath)),
    lastRepoPath: path.resolve(repoPath),
    branch: snapshot.branch ?? null,
    commitSha: snapshot.commitSha ?? null,
    createdAt,
    updatedAt: nowIso()
  };
  await ensureDirectory(path.dirname(store.metadataPath));
  await fs.writeFile(store.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith(`~${path.sep}`)) return path.join(os.homedir(), input.slice(2));
  return input;
}

function tryParseJson(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}
