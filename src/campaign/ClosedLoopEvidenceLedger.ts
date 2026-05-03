import { stableHash } from "../staxcore/shared/id.js";
import { AppendOnlyLedger } from "../staxcore/shared/ledger/appendOnlyLedger.js";
import type { ClosedLoopCodexLedger, ClosedLoopCodexTask } from "./ClosedLoopCodexCampaign.js";

export const CLOSED_LOOP_DOCTRINE_VERSION = "core-v1";
export const CLOSED_LOOP_RUNTIME_VERSION = "0.1.0";

export type ClosedLoopEvidenceSnapshot = {
  taskId: string;
  auditTraceId: string;
  inputHash: string;
  diffHash: string;
  commandEvidenceHash: string;
  claimMapHash: string;
  verdictHash: string;
  doctrineVersion: string;
  runtimeVersion: string;
};

type ClosedLoopEvidenceLedgerEvent = ClosedLoopEvidenceSnapshot & {
  index: number;
};

export type ClosedLoopEvidenceReplaySummary = {
  deterministic: boolean;
  chainValid: boolean;
  replayValid: boolean;
  doctrineVersion: string;
  runtimeVersion: string;
  snapshotCount: number;
  auditTraceIds: string[];
  ledgerHashes: string[];
  issues: string[];
};

function createDeterministicAuditTraceId(task: ClosedLoopCodexTask, doctrineVersion: string, runtimeVersion: string): string {
  return `trace_${stableHash({
    taskId: task.taskId,
    repo: task.repo,
    doctrineVersion,
    runtimeVersion
  }).slice(0, 16)}`;
}

export function buildClosedLoopEvidenceSnapshot(args: {
  task: ClosedLoopCodexTask;
  doctrineVersion?: string;
  runtimeVersion?: string;
}): ClosedLoopEvidenceSnapshot {
  const doctrineVersion = args.doctrineVersion ?? CLOSED_LOOP_DOCTRINE_VERSION;
  const runtimeVersion = args.runtimeVersion ?? CLOSED_LOOP_RUNTIME_VERSION;
  const task = args.task;
  return {
    taskId: task.taskId,
    auditTraceId: createDeterministicAuditTraceId(task, doctrineVersion, runtimeVersion),
    inputHash: stableHash({
      repo: task.repo,
      objective: task.objective,
      staxInitialAudit: task.staxInitialAudit,
      staxCodexPrompt: task.staxCodexPrompt,
      codexReport: task.codexReport,
      stateHistory: task.stateHistory
    }),
    diffHash: stableHash({ diffEvidence: task.diffEvidence }),
    commandEvidenceHash: stableHash({ commandEvidence: task.commandEvidence }),
    claimMapHash: stableHash({
      objective: task.objective,
      staxInitialAudit: task.staxInitialAudit,
      codexReport: task.codexReport,
      staxPostCodexAudit: task.staxPostCodexAudit,
      nextAction: task.nextAction ?? null,
      failurePatterns: task.failurePatterns ?? [],
      evalCandidates: task.evalCandidates ?? []
    }),
    verdictHash: stableHash({
      finalOutcome: task.finalOutcome,
      falseAccept: task.falseAccept,
      falseBlock: task.falseBlock,
      usefulBlock: task.usefulBlock,
      verifiedAccept: task.verifiedAccept,
      staxInitialPromptUseful: task.staxInitialPromptUseful,
      evalCandidate: task.evalCandidate,
      state: task.state
    }),
    doctrineVersion,
    runtimeVersion
  };
}

export function replayClosedLoopEvidenceLedger(args: {
  ledger: ClosedLoopCodexLedger;
  doctrineVersion?: string;
  runtimeVersion?: string;
}): ClosedLoopEvidenceReplaySummary {
  const doctrineVersion = args.doctrineVersion ?? CLOSED_LOOP_DOCTRINE_VERSION;
  const runtimeVersion = args.runtimeVersion ?? CLOSED_LOOP_RUNTIME_VERSION;
  const snapshots = args.ledger.tasks.map((task) =>
    buildClosedLoopEvidenceSnapshot({ task, doctrineVersion, runtimeVersion })
  );

  const appendOnlyLedger = new AppendOnlyLedger<ClosedLoopEvidenceLedgerEvent>();
  for (const [index, snapshot] of snapshots.entries()) {
    appendOnlyLedger.append(
      `closed_loop_evidence_${index + 1}`,
      {
        index,
        ...snapshot
      },
      { doctrineVersion }
    );
  }

  const controlHashes = args.ledger.tasks.map((task) =>
    stableHash(buildClosedLoopEvidenceSnapshot({ task, doctrineVersion, runtimeVersion }))
  );
  const runHashes = snapshots.map((snapshot) => stableHash(snapshot));
  const deterministic = runHashes.every((hash, index) => hash === controlHashes[index]);
  const chainCheck = appendOnlyLedger.verifyChain();
  const issues = [...chainCheck.issues];

  const duplicateTraceIds = snapshots
    .map((snapshot) => snapshot.auditTraceId)
    .filter((traceId, index, values) => values.indexOf(traceId) !== index);
  if (duplicateTraceIds.length > 0) {
    issues.push(`duplicate auditTraceId values found: ${Array.from(new Set(duplicateTraceIds)).join(", ")}`);
  }

  for (const snapshot of snapshots) {
    if (!snapshot.auditTraceId.trim()) issues.push(`${snapshot.taskId}: missing auditTraceId`);
    if (!snapshot.inputHash.trim()) issues.push(`${snapshot.taskId}: missing inputHash`);
    if (!snapshot.diffHash.trim()) issues.push(`${snapshot.taskId}: missing diffHash`);
    if (!snapshot.commandEvidenceHash.trim()) issues.push(`${snapshot.taskId}: missing commandEvidenceHash`);
    if (!snapshot.claimMapHash.trim()) issues.push(`${snapshot.taskId}: missing claimMapHash`);
    if (!snapshot.verdictHash.trim()) issues.push(`${snapshot.taskId}: missing verdictHash`);
    if (!snapshot.doctrineVersion.trim()) issues.push(`${snapshot.taskId}: missing doctrineVersion`);
    if (!snapshot.runtimeVersion.trim()) issues.push(`${snapshot.taskId}: missing runtimeVersion`);
  }

  return {
    deterministic,
    chainValid: chainCheck.valid,
    replayValid: deterministic && chainCheck.valid && issues.length === 0,
    doctrineVersion,
    runtimeVersion,
    snapshotCount: snapshots.length,
    auditTraceIds: snapshots.map((snapshot) => snapshot.auditTraceId),
    ledgerHashes: appendOnlyLedger.replay().map((entry) => entry.ledgerHash),
    issues
  };
}
