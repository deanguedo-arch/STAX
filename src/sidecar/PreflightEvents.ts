import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDirectory,
  nowIso,
  readTextIfExists,
  sanitizeId,
  sha256,
  shortHash,
  sidecarDir,
  validateRepoPath
} from "./SidecarRepo.js";
import { externalCommandEvidenceStoreForRepo } from "./ExternalCommandEvidenceStore.js";

export const STAX_PREFLIGHT_EVENT_SCHEMA_VERSION = "stax-preflight-event-v1" as const;
export const STAX_PREFLIGHT_BYPASS_SCHEMA_VERSION = "stax-preflight-bypass-v1" as const;
export const STAX_PREFLIGHT_APPROVAL_SCHEMA_VERSION = "stax-preflight-approval-v1" as const;

export type PreflightEventRecord = {
  schemaVersion: typeof STAX_PREFLIGHT_EVENT_SCHEMA_VERSION;
  eventId: string;
  generatedAt: string;
  repoPathHash: string;
  repoName: string;
  mode: string;
  boundary: string;
  modeSource?: string;
  boundarySource?: string;
  verdict: string;
  protocolStatus?: string;
  recommendedExitCode: number;
  exitCode: number;
  enforcement: "observer" | "soft" | "hard";
  bypassed: boolean;
  approved: boolean;
  reason: string;
  worktreeFingerprintHash?: string;
};

export type PreflightBypassRecord = {
  schemaVersion: typeof STAX_PREFLIGHT_BYPASS_SCHEMA_VERSION;
  eventId: string;
  generatedAt: string;
  repoPathHash: string;
  repoName: string;
  mode: string;
  boundary: string;
  reason: string;
  actor?: string;
  statusVerdict: string;
  protocolStatus?: string;
};

export type PreflightApprovalRecord = {
  schemaVersion: typeof STAX_PREFLIGHT_APPROVAL_SCHEMA_VERSION;
  approvedAt: string;
  approvedBy: string;
  reason: string;
  boundary: string;
  repoPathHash: string;
  worktreeFingerprintHash?: string;
  expiresAt?: string;
};

export type PreflightApprovalValidation = {
  valid: boolean;
  path?: string;
  reason?: string;
  approval?: PreflightApprovalRecord;
};

export async function writePreflightEvent(repoPathInput: string, event: Omit<PreflightEventRecord, "schemaVersion">): Promise<{
  sidecarPath: string;
  externalPath: string;
}> {
  const repoPath = await validateRepoPath(repoPathInput);
  const record: PreflightEventRecord = {
    schemaVersion: STAX_PREFLIGHT_EVENT_SCHEMA_VERSION,
    ...event
  };
  return writeEventCopies(repoPath, record.eventId, "preflight", record);
}

export async function writePreflightBypassEvent(repoPathInput: string, event: Omit<PreflightBypassRecord, "schemaVersion">): Promise<{
  sidecarPath: string;
  externalPath: string;
}> {
  const repoPath = await validateRepoPath(repoPathInput);
  const record: PreflightBypassRecord = {
    schemaVersion: STAX_PREFLIGHT_BYPASS_SCHEMA_VERSION,
    ...event
  };
  return writeEventCopies(repoPath, record.eventId, "bypass", record);
}

export async function validatePreflightApproval(input: {
  repoPath: string;
  approvalPath?: string;
  boundary: string;
  worktreeFingerprintHash?: string;
  now?: Date;
}): Promise<PreflightApprovalValidation> {
  const repoPath = await validateRepoPath(input.repoPath);
  const approvalPath = input.approvalPath ?? path.join(sidecarDir(repoPath), "approval.json");
  const raw = await readTextIfExists(approvalPath);
  if (!raw.trim()) return { valid: false, path: approvalPath, reason: "approval artifact missing" };
  let parsed: PreflightApprovalRecord;
  try {
    parsed = JSON.parse(raw) as PreflightApprovalRecord;
  } catch {
    return { valid: false, path: approvalPath, reason: "approval artifact is malformed JSON" };
  }
  if (parsed.schemaVersion !== STAX_PREFLIGHT_APPROVAL_SCHEMA_VERSION) {
    return { valid: false, path: approvalPath, reason: "approval schemaVersion is not recognized" };
  }
  const repoPathHash = sha256(path.resolve(repoPath));
  if (parsed.repoPathHash !== repoPathHash) {
    return { valid: false, path: approvalPath, reason: "approval repoPathHash does not match this repo" };
  }
  if (parsed.boundary !== input.boundary) {
    return { valid: false, path: approvalPath, reason: "approval boundary does not match this preflight boundary" };
  }
  if (parsed.worktreeFingerprintHash && input.worktreeFingerprintHash && parsed.worktreeFingerprintHash !== input.worktreeFingerprintHash) {
    return { valid: false, path: approvalPath, reason: "approval worktree fingerprint does not match current repo state" };
  }
  if (parsed.expiresAt && Date.parse(parsed.expiresAt) < (input.now ?? new Date()).getTime()) {
    return { valid: false, path: approvalPath, reason: "approval artifact is expired" };
  }
  if (!parsed.approvedBy || !parsed.reason) {
    return { valid: false, path: approvalPath, reason: "approval artifact is missing approver or reason" };
  }
  return { valid: true, path: approvalPath, approval: parsed };
}

export function preflightEventId(prefix: string, generatedAt: string, repoPath: string, reason: string): string {
  return `${sanitizeId(prefix)}_${sanitizeId(`${generatedAt}_${shortHash(`${repoPath}:${reason}`)}`)}`;
}

async function writeEventCopies(
  repoPath: string,
  eventId: string,
  kind: string,
  record: unknown
): Promise<{ sidecarPath: string; externalPath: string }> {
  const sidecarEventsDir = path.join(sidecarDir(repoPath), "events");
  const externalStore = externalCommandEvidenceStoreForRepo(repoPath);
  const externalEventsDir = path.join(externalStore.repoStoreDir, "events");
  await ensureDirectory(sidecarEventsDir);
  await ensureDirectory(externalEventsDir);
  const fileName = `${kind}_${eventId}.json`;
  const sidecarPath = path.join(sidecarEventsDir, fileName);
  const externalPath = path.join(externalEventsDir, fileName);
  const content = `${JSON.stringify(record, null, 2)}\n`;
  await fs.writeFile(sidecarPath, content, "utf8");
  await fs.writeFile(externalPath, content, "utf8");
  return { sidecarPath, externalPath };
}

export function preflightGeneratedAt(): string {
  return nowIso();
}
