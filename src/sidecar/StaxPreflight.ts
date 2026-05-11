import path from "node:path";
import { classifySidecarCommandRisk, type SidecarCommandRiskClassification } from "./CommandRiskPolicy.js";
import {
  preflightEventId,
  preflightGeneratedAt,
  validatePreflightApproval,
  writePreflightBypassEvent,
  writePreflightEvent,
  type PreflightApprovalValidation
} from "./PreflightEvents.js";
import { runStaxGate, type StaxGateStatus } from "./StaxGate.js";
import { collectWorktreeFingerprint, type WorktreeFingerprint } from "./WorktreeFingerprint.js";
import { collectGitSnapshot, readTextIfExists, sha256, sidecarDir, validateRepoPath } from "./SidecarRepo.js";

export type StaxPreflightMode = "observer" | "soft" | "hard";
export type StaxPreflightBoundary =
  | "local"
  | "handoff"
  | "commit"
  | "push"
  | "merge"
  | "release"
  | "deploy"
  | "data_publish"
  | "ci";
export type StaxPreflightExitCode = 0 | 1 | 2 | 3 | 4 | 5;
export type StaxPreflightPolicySource = "explicit" | "config" | "default";

export type StaxPreflightBoundaryPolicy = Partial<Record<StaxPreflightBoundary, StaxPreflightMode>>;

export const DEFAULT_PREFLIGHT_BOUNDARY_POLICY: Record<StaxPreflightBoundary, StaxPreflightMode> = {
  local: "observer",
  handoff: "soft",
  commit: "soft",
  push: "soft",
  merge: "hard",
  release: "hard",
  deploy: "hard",
  data_publish: "hard",
  ci: "hard"
};

export type RunStaxPreflightOptions = {
  repoPath: string;
  mode?: StaxPreflightMode;
  boundary?: StaxPreflightBoundary;
  command?: string[];
  bypassReason?: string;
  approvalPath?: string;
  actor?: string;
  now?: Date;
  writeLearningEvent?: boolean;
};

export type StaxPreflightResult = {
  schemaVersion: "stax-preflight-result-v1";
  generatedAt: string;
  repo: string;
  repoPath: string;
  repoPathHash: string;
  branch?: string;
  commitSha?: string;
  mode: StaxPreflightMode;
  boundary: StaxPreflightBoundary;
  modeSource: StaxPreflightPolicySource;
  boundarySource: StaxPreflightPolicySource;
  verdict: StaxGateStatus["verdict"];
  protocolStatus?: StaxGateStatus["protocolStatus"];
  recommendedExitCode: StaxPreflightExitCode;
  exitCode: StaxPreflightExitCode;
  enforcement: StaxPreflightMode;
  blocking: boolean;
  bypassed: boolean;
  approved: boolean;
  reason: string;
  statusPath: string;
  eventPaths: string[];
  worktreeFingerprintHash: string;
  commandRisk?: SidecarCommandRiskClassification;
  approval?: PreflightApprovalValidation;
};

export async function runStaxPreflight(options: RunStaxPreflightOptions): Promise<StaxPreflightResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  const policy = await resolvePreflightPolicy(repoPath, options);
  const mode = policy.mode;
  const boundary = policy.boundary;
  const generatedAt = (options.now ?? new Date()).toISOString();
  const [snapshot, fingerprint, status] = await Promise.all([
    collectGitSnapshot(repoPath),
    collectWorktreeFingerprint(repoPath),
    runStaxGate({
      repoPath,
      writeLearningEvent: options.writeLearningEvent ?? false,
      now: options.now
    })
  ]);
  const commandRisk = options.command?.length ? classifySidecarCommandRisk(options.command) : undefined;
  const approval = await validatePreflightApproval({
    repoPath,
    approvalPath: options.approvalPath,
    boundary,
    worktreeFingerprintHash: fingerprint.fingerprintHash,
    now: options.now
  });
  const recommendedExitCode = recommendedPreflightExitCode(status, commandRisk);
  const bypassed = Boolean(options.bypassReason?.trim());
  const approved = approval.valid && approvalCanSatisfy(status, recommendedExitCode);
  const exitCode = enforcedExitCode({
    mode,
    recommendedExitCode,
    bypassed,
    approved
  });
  const blocking = exitCode !== 0;
  const reason = preflightReason({
    status,
    recommendedExitCode,
    exitCode,
    mode,
    bypassed,
    approved,
    commandRisk
  });
  const repoPathHash = sha256(path.resolve(repoPath));
  const eventId = preflightEventId("preflight", generatedAt, repoPath, reason);
  const event = await writePreflightEvent(repoPath, {
    eventId,
    generatedAt,
    repoPathHash,
    repoName: snapshot.repoName,
    mode,
    boundary,
    modeSource: policy.modeSource,
    boundarySource: policy.boundarySource,
    verdict: status.verdict,
    protocolStatus: status.protocolStatus,
    recommendedExitCode,
    exitCode,
    enforcement: mode,
    bypassed,
    approved,
    reason,
    worktreeFingerprintHash: fingerprint.fingerprintHash
  });
  const eventPaths = [event.sidecarPath, event.externalPath];
  if (bypassed) {
    const bypass = await writePreflightBypassEvent(repoPath, {
      eventId: preflightEventId("bypass", generatedAt, repoPath, options.bypassReason ?? ""),
      generatedAt,
      repoPathHash,
      repoName: snapshot.repoName,
      mode,
      boundary,
      reason: options.bypassReason?.trim() ?? "",
      actor: options.actor,
      statusVerdict: status.verdict,
      protocolStatus: status.protocolStatus
    });
    eventPaths.push(bypass.sidecarPath, bypass.externalPath);
  }

  return {
    schemaVersion: "stax-preflight-result-v1",
    generatedAt,
    repo: snapshot.repoName,
    repoPath,
    repoPathHash,
    branch: snapshot.branch,
    commitSha: snapshot.commitSha,
    mode,
    boundary,
    modeSource: policy.modeSource,
    boundarySource: policy.boundarySource,
    verdict: status.verdict,
    protocolStatus: status.protocolStatus,
    recommendedExitCode,
    exitCode,
    enforcement: mode,
    blocking,
    bypassed,
    approved,
    reason,
    statusPath: path.join(repoPath, ".stax", "status.json"),
    eventPaths,
    worktreeFingerprintHash: fingerprint.fingerprintHash,
    commandRisk,
    approval
  };
}

export async function resolvePreflightPolicy(
  repoPathInput: string,
  options: Pick<RunStaxPreflightOptions, "mode" | "boundary"> = {}
): Promise<{
  mode: StaxPreflightMode;
  boundary: StaxPreflightBoundary;
  modeSource: StaxPreflightPolicySource;
  boundarySource: StaxPreflightPolicySource;
}> {
  const repoPath = await validateRepoPath(repoPathInput);
  const config = await readPreflightConfig(repoPath);
  const configuredBoundary = parseBoundary(config.preflightDefaultBoundary);
  const boundary = options.boundary ?? configuredBoundary ?? "local";
  const boundarySource: StaxPreflightPolicySource = options.boundary
    ? "explicit"
    : configuredBoundary
      ? "config"
      : "default";
  const configuredPolicy = parseBoundaryPolicy(config.preflightBoundaryPolicy);
  const configuredMode = configuredPolicy[boundary];
  const mode = options.mode ?? configuredMode ?? DEFAULT_PREFLIGHT_BOUNDARY_POLICY[boundary];
  const modeSource: StaxPreflightPolicySource = options.mode
    ? "explicit"
    : configuredMode
      ? "config"
      : "default";
  return {
    mode,
    boundary,
    modeSource,
    boundarySource
  };
}

async function readPreflightConfig(repoPath: string): Promise<{
  preflightDefaultBoundary?: unknown;
  preflightBoundaryPolicy?: unknown;
}> {
  const raw = await readTextIfExists(path.join(sidecarDir(repoPath), "config.json"));
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { preflightDefaultBoundary?: unknown; preflightBoundaryPolicy?: unknown }
      : {};
  } catch {
    return {};
  }
}

function parseBoundaryPolicy(input: unknown): StaxPreflightBoundaryPolicy {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const policy: StaxPreflightBoundaryPolicy = {};
  for (const [rawBoundary, rawMode] of Object.entries(input)) {
    const boundary = parseBoundary(rawBoundary);
    const mode = parseMode(rawMode);
    if (boundary && mode) policy[boundary] = mode;
  }
  return policy;
}

function parseMode(input: unknown): StaxPreflightMode | undefined {
  return input === "observer" || input === "soft" || input === "hard" ? input : undefined;
}

function parseBoundary(input: unknown): StaxPreflightBoundary | undefined {
  return input === "local" ||
    input === "handoff" ||
    input === "commit" ||
    input === "push" ||
    input === "merge" ||
    input === "release" ||
    input === "deploy" ||
    input === "data_publish" ||
    input === "ci"
    ? input
    : undefined;
}

function recommendedPreflightExitCode(
  status: StaxGateStatus,
  commandRisk?: SidecarCommandRiskClassification
): StaxPreflightExitCode {
  if (hasEvidenceIntegrityFailure(status)) return 4;
  if (status.protocolStatus === "failure") return 3;
  if (commandRisk?.dangerous) return 2;
  if (status.verdict === "Accept") return 0;
  if (status.verdict === "Reject") return 1;
  return 2;
}

function enforcedExitCode(input: {
  mode: StaxPreflightMode;
  recommendedExitCode: StaxPreflightExitCode;
  bypassed: boolean;
  approved: boolean;
}): StaxPreflightExitCode {
  if (input.mode === "observer") return 0;
  if (input.recommendedExitCode === 0) return 0;
  if (input.mode === "soft" && (input.bypassed || input.approved)) return 0;
  if (input.mode === "soft") return input.recommendedExitCode === 1 ? 2 : input.recommendedExitCode;
  if (input.approved && input.recommendedExitCode === 2) return 0;
  return input.recommendedExitCode;
}

function approvalCanSatisfy(status: StaxGateStatus, recommendedExitCode: StaxPreflightExitCode): boolean {
  if (recommendedExitCode !== 2) return false;
  return status.verdict === "Human review" || status.verdict === "Provisional";
}

function preflightReason(input: {
  status: StaxGateStatus;
  recommendedExitCode: StaxPreflightExitCode;
  exitCode: StaxPreflightExitCode;
  mode: StaxPreflightMode;
  bypassed: boolean;
  approved: boolean;
  commandRisk?: SidecarCommandRiskClassification;
}): string {
  if (input.mode === "observer" && input.recommendedExitCode !== 0) {
    return `Observer mode recorded ${input.status.verdict}; workflow was not blocked.`;
  }
  if (input.bypassed && input.exitCode === 0) return "Soft preflight bypass was recorded with a human reason.";
  if (input.approved && input.exitCode === 0) return "Human approval artifact satisfied this preflight boundary.";
  if (input.commandRisk?.dangerous) {
    return `Command requires explicit approval: ${input.commandRisk.categories.join(", ")}.`;
  }
  if (input.recommendedExitCode === 4) return "Command evidence integrity or freshness failed.";
  if (input.recommendedExitCode === 3) return "Protocol failure requires correction before this boundary.";
  if (input.status.verdict === "Accept") return "STAX gate accepted the current proof state.";
  return input.status.why;
}

function hasEvidenceIntegrityFailure(status: StaxGateStatus): boolean {
  const text = [...status.unverified, ...status.risk, status.why].join("\n").toLowerCase();
  return /\b(tampered_evidence|stale_evidence|wrong_worktree|ledger_unverified|missing_stream_hash|wrong cwd|wrong repo|wrong branch)\b/.test(text);
}

export function createPreflightApprovalTemplate(input: {
  repoPath: string;
  boundary: StaxPreflightBoundary;
  fingerprint: WorktreeFingerprint;
  approvedBy: string;
  reason: string;
  now?: Date;
}): string {
  return `${JSON.stringify(
    {
      schemaVersion: "stax-preflight-approval-v1",
      approvedAt: (input.now ?? new Date()).toISOString(),
      approvedBy: input.approvedBy,
      reason: input.reason,
      boundary: input.boundary,
      repoPathHash: sha256(path.resolve(input.repoPath)),
      worktreeFingerprintHash: input.fingerprint.fingerprintHash
    },
    null,
    2
  )}\n`;
}

export function nowPreflightEventId(repoPath: string, reason: string): string {
  const generatedAt = preflightGeneratedAt();
  return preflightEventId("preflight", generatedAt, repoPath, reason);
}
