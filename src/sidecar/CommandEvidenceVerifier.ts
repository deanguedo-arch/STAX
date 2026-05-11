import path from "node:path";
import type { ProjectControlCommandEvidenceEntry } from "../projectControl/ProjectControlEvidencePacket.js";
import { runGit, sha256 } from "./SidecarRepo.js";
import type {
  CommandEvidenceLedgerRecord,
  CommandEvidenceLedgerVerification
} from "./CommandEvidenceLedger.js";
import {
  canonicalJson,
  isWorktreeFingerprintExcludedPath,
  type WorktreeFingerprint
} from "./WorktreeFingerprint.js";

export const COMMAND_EVIDENCE_COLLECTOR_VERSION = "stax-sidecar-command-evidence-v1";

export type CommandEvidenceProvenanceStatus =
  | "verified_local_stax_command"
  | "unverified_sidecar_json"
  | "tampered_evidence"
  | "stale_evidence"
  | "wrong_repo"
  | "wrong_branch"
  | "wrong_cwd"
  | "wrong_commit"
  | "wrong_worktree"
  | "missing_stream_hash"
  | "ledger_unverified";

export type SidecarCommandEvidenceWithProvenance = ProjectControlCommandEvidenceEntry & {
  evidenceId?: string;
  stdoutPath?: string;
  stderrPath?: string;
  warning?: string;
  worktreeBefore?: WorktreeFingerprint;
  worktreeAfter?: WorktreeFingerprint;
  stdoutHash?: string;
  stderrHash?: string;
  canonicalEvidenceHash?: string;
  collectorVersion?: string;
  evidenceStore?: "external_user_store" | "repo_local_legacy";
  externalRepoId?: string;
  externalEvidencePath?: string;
  externalLedgerPath?: string;
  repoPointerPath?: string;
  provenanceStatus: CommandEvidenceProvenanceStatus;
  provenanceIssues: string[];
  ledgerHash?: string;
};

export function canonicalCommandEvidenceHash(evidence: Record<string, unknown>): string {
  const canonicalPayload = { ...evidence };
  delete canonicalPayload.canonicalEvidenceHash;
  delete canonicalPayload.evidenceHash;
  return sha256(canonicalJson(canonicalPayload));
}

export async function verifySidecarCommandEvidence(input: {
  repoPath: string;
  currentRepoName: string;
  currentBranch?: string;
  currentCommitSha?: string;
  currentFingerprint: WorktreeFingerprint;
  parsed: Record<string, unknown> & ProjectControlCommandEvidenceEntry;
  evidenceId: string;
  evidenceFileName: string;
  stdoutFileName?: string;
  stderrFileName?: string;
  stdout: string;
  stderr: string;
  ledgerVerification: CommandEvidenceLedgerVerification;
}): Promise<{
  provenanceStatus: CommandEvidenceProvenanceStatus;
  provenanceIssues: string[];
  ledgerRecord?: CommandEvidenceLedgerRecord;
}> {
  const issues: string[] = [];
  const ledgerRecord = input.ledgerVerification.recordsByEvidenceId.get(input.evidenceId);
  const claimedSource = input.parsed.source ?? "local_stax_command_output";
  const parsedStdoutHash = stringField(input.parsed, "stdoutHash");
  const parsedStderrHash = stringField(input.parsed, "stderrHash");
  const parsedEvidenceHash = stringField(input.parsed, "canonicalEvidenceHash");
  const worktreeBeforeHash = fingerprintHashField(input.parsed, "worktreeBefore");
  const worktreeAfterHash = fingerprintHashField(input.parsed, "worktreeAfter");
  if (claimedSource !== "local_stax_command_output") {
    issues.push(`Command evidence ${input.evidenceId} is not locally collected STAX command proof.`);
    return { provenanceStatus: "unverified_sidecar_json", provenanceIssues: issues, ledgerRecord };
  }

  if (!input.ledgerVerification.valid) {
    issues.push(...input.ledgerVerification.issues.map((issue) => `Command evidence ledger issue: ${issue}`));
  }
  if (!ledgerRecord) {
    issues.push(`Command evidence ${input.evidenceId} is missing from the sidecar command ledger.`);
  }
  if (!parsedStdoutHash || !parsedStderrHash || !parsedEvidenceHash) {
    issues.push(`Command evidence ${input.evidenceId} is missing stream or evidence hashes.`);
  }
  const actualStdoutHash = sha256(input.stdout);
  const actualStderrHash = sha256(input.stderr);
  if (parsedStdoutHash && parsedStdoutHash !== actualStdoutHash) {
    issues.push(`Command evidence ${input.evidenceId} stdout hash does not match stdout file.`);
  }
  if (parsedStderrHash && parsedStderrHash !== actualStderrHash) {
    issues.push(`Command evidence ${input.evidenceId} stderr hash does not match stderr file.`);
  }
  const actualEvidenceHash = canonicalCommandEvidenceHash(input.parsed);
  if (parsedEvidenceHash && parsedEvidenceHash !== actualEvidenceHash) {
    issues.push(`Command evidence ${input.evidenceId} JSON hash does not verify.`);
  }
  if (ledgerRecord) {
    if (ledgerRecord.evidencePath !== input.evidenceFileName) {
      issues.push(`Command evidence ${input.evidenceId} ledger points at ${ledgerRecord.evidencePath}, not ${input.evidenceFileName}.`);
    }
    if (input.stdoutFileName && ledgerRecord.stdoutPath !== input.stdoutFileName) {
      issues.push(`Command evidence ${input.evidenceId} ledger stdout path does not match evidence JSON.`);
    }
    if (input.stderrFileName && ledgerRecord.stderrPath !== input.stderrFileName) {
      issues.push(`Command evidence ${input.evidenceId} ledger stderr path does not match evidence JSON.`);
    }
    if (ledgerRecord.stdoutHash !== actualStdoutHash || ledgerRecord.stderrHash !== actualStderrHash) {
      issues.push(`Command evidence ${input.evidenceId} stream hashes do not match ledger.`);
    }
    if (ledgerRecord.evidenceHash !== actualEvidenceHash) {
      issues.push(`Command evidence ${input.evidenceId} evidence hash does not match ledger.`);
    }
    if (worktreeBeforeHash && ledgerRecord.worktreeBeforeHash !== worktreeBeforeHash) {
      issues.push(`Command evidence ${input.evidenceId} before-worktree hash does not match ledger.`);
    }
    if (worktreeAfterHash && ledgerRecord.worktreeAfterHash !== worktreeAfterHash) {
      issues.push(`Command evidence ${input.evidenceId} after-worktree hash does not match ledger.`);
    }
  }

  if (input.parsed.repo && input.parsed.repo !== input.currentRepoName) {
    issues.push(`Command evidence ${input.evidenceId} repo ${input.parsed.repo} does not match ${input.currentRepoName}.`);
    return { provenanceStatus: "wrong_repo", provenanceIssues: issues, ledgerRecord };
  }
  if (input.parsed.branch && input.currentBranch && input.parsed.branch !== input.currentBranch) {
    issues.push(`Command evidence ${input.evidenceId} branch ${input.parsed.branch} does not match ${input.currentBranch}.`);
    return { provenanceStatus: "wrong_branch", provenanceIssues: issues, ledgerRecord };
  }
  if (input.parsed.cwd && path.resolve(input.parsed.cwd) !== input.repoPath) {
    issues.push(`Command evidence ${input.evidenceId} cwd ${input.parsed.cwd} does not match ${input.repoPath}.`);
    return { provenanceStatus: "wrong_cwd", provenanceIssues: issues, ledgerRecord };
  }
  if (input.parsed.commitSha && input.currentCommitSha && input.parsed.commitSha !== input.currentCommitSha) {
    const sidecarOnlyAdvance = await evidenceCommitDiffIsSidecarManaged(input.repoPath, input.parsed.commitSha);
    if (!sidecarOnlyAdvance) {
      issues.push(`Command evidence ${input.evidenceId} commit ${input.parsed.commitSha} does not match ${input.currentCommitSha}.`);
      return { provenanceStatus: "wrong_commit", provenanceIssues: issues, ledgerRecord };
    }
  }
  if (!worktreeAfterHash) {
    issues.push(`Command evidence ${input.evidenceId} is missing an after-worktree fingerprint.`);
  } else if (worktreeAfterHash !== input.currentFingerprint.fingerprintHash) {
    issues.push(`Command evidence ${input.evidenceId} after-worktree fingerprint is stale for the current auditable worktree.`);
    return { provenanceStatus: "wrong_worktree", provenanceIssues: issues, ledgerRecord };
  }

  if (issues.some((issue) => /stdout hash does not match|stderr hash does not match|JSON hash does not verify|stream hashes do not match|evidence hash does not match|worktree hash does not match/i.test(issue))) {
    return { provenanceStatus: "tampered_evidence", provenanceIssues: issues, ledgerRecord };
  }
  if (issues.some((issue) => /missing stream|missing an after-worktree/i.test(issue))) {
    return { provenanceStatus: "missing_stream_hash", provenanceIssues: issues, ledgerRecord };
  }
  if (!ledgerRecord || !input.ledgerVerification.valid) {
    return { provenanceStatus: "ledger_unverified", provenanceIssues: issues, ledgerRecord };
  }
  return { provenanceStatus: "verified_local_stax_command", provenanceIssues: issues, ledgerRecord };
}

async function evidenceCommitDiffIsSidecarManaged(repoPath: string, evidenceCommitSha: string): Promise<boolean> {
  const changed = await runGit(repoPath, ["diff", "--name-only", `${evidenceCommitSha}..HEAD`]);
  const paths = changed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return paths.length > 0 && paths.every(isWorktreeFingerprintExcludedPath);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function fingerprintHashField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (!value || typeof value !== "object") return undefined;
  const fingerprintHash = (value as Record<string, unknown>).fingerprintHash;
  return typeof fingerprintHash === "string" ? fingerprintHash : undefined;
}
