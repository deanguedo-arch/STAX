import { stableHash } from "../shared/index.js";
import type { CorrectionEvent } from "../types/index.js";
import { replayLedger } from "./replayLedger.js";
import type { KernelLedgerEvent, KernelLedgerRecord } from "./types.js";

export interface TruthSnapshotRecord {
  ledgerRecordId: string;
  ledgerHash: string;
  previousHash: string | null;
  sequence: number;
  recordedAt: string;
  eventType: KernelLedgerEvent["type"];
  truthState: "VALIDATED" | "CONFLICTED" | "REJECTED";
  candidateId: string;
  truthId: string;
  sourceId: string;
  sourceType: string;
}

export interface TruthSnapshotCorrection {
  ledgerRecordId: string;
  ledgerHash: string;
  previousHash: string | null;
  sequence: number;
  recordedAt: string;
  correctionId: string;
  correctionType: CorrectionEvent["type"];
  relatedValidationId: string;
  supersedesTruthId?: string;
  replacementTruthId?: string;
  supersededByCorrectionId?: string;
}

export interface TruthSnapshotSupersession {
  correctionId: string;
  ledgerRecordId: string;
  supersedesTruthId: string;
  replacementTruthId: string;
}

export interface TruthSnapshot {
  doctrineVersion: string;
  rootHash: string | null;
  replaySignature: string;
  recordCount: number;
  records: TruthSnapshotRecord[];
  corrections: TruthSnapshotCorrection[];
  supersessionIndex: Record<string, TruthSnapshotSupersession>;
  supersededTruthIds: string[];
  activeTruthIds: string[];
  latestByCandidateId: Record<string, string>;
  conflictIndex: Record<string, string[]>;
  rejectedCandidateIds: string[];
}

export interface TruthSnapshotVerification {
  valid: boolean;
  issues: string[];
}

function eventRecord(
  record: KernelLedgerRecord<KernelLedgerEvent>
): TruthSnapshotRecord | null {
  if (record.event.type === "correction_event") return null;

  if (record.event.type === "rejected_candidate") {
    const rejection = record.event.rejection;
    return {
      ledgerRecordId: record.id,
      ledgerHash: record.hash,
      previousHash: record.previousHash,
      sequence: record.sequence,
      recordedAt: record.recordedAt,
      eventType: record.event.type,
      truthState: "REJECTED",
      candidateId: rejection.candidateId,
      truthId: rejection.id,
      sourceId: rejection.sourceId,
      sourceType: rejection.sourceType
    };
  }

  return {
    ledgerRecordId: record.id,
    ledgerHash: record.hash,
    previousHash: record.previousHash,
    sequence: record.sequence,
    recordedAt: record.recordedAt,
    eventType: record.event.type,
    truthState:
      record.event.type === "conflicted_event" ? "CONFLICTED" : "VALIDATED",
    candidateId: record.event.event.candidateId,
    truthId: record.event.event.id,
    sourceId: record.event.event.sourceId,
    sourceType: record.event.event.sourceType
  };
}

function correctionRecord(
  record: KernelLedgerRecord<KernelLedgerEvent>
): TruthSnapshotCorrection | null {
  if (record.event.type !== "correction_event") return null;

  const correction = record.event.correction;
  const snapshotCorrection: TruthSnapshotCorrection = {
    ledgerRecordId: record.id,
    ledgerHash: record.hash,
    previousHash: record.previousHash,
    sequence: record.sequence,
    recordedAt: record.recordedAt,
    correctionId: correction.correctionId,
    correctionType: correction.type,
    relatedValidationId: correction.relatedValidationId
  };

  if (correction.type === "CorrectionApplied") {
    snapshotCorrection.supersedesTruthId = correction.supersedesValidationId;
    snapshotCorrection.replacementTruthId = correction.replacementValidationId;
  }

  if (correction.type === "CorrectionSuperseded") {
    snapshotCorrection.supersededByCorrectionId =
      correction.supersededByCorrectionId;
  }

  return snapshotCorrection;
}

function isAppliedCorrection(
  correction: TruthSnapshotCorrection
): correction is TruthSnapshotCorrection & {
  supersedesTruthId: string;
  replacementTruthId: string;
} {
  return (
    correction.correctionType === "CorrectionApplied" &&
    Boolean(correction.supersedesTruthId) &&
    Boolean(correction.replacementTruthId)
  );
}

export function buildTruthSnapshot(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): TruthSnapshot {
  const replay = replayLedger(records);
  const snapshotRecords = records.flatMap((record) => {
    const truth = eventRecord(record);
    return truth ? [truth] : [];
  });
  const corrections = records.flatMap((record) => {
    const correction = correctionRecord(record);
    return correction ? [correction] : [];
  });
  const supersessionIndex: Record<string, TruthSnapshotSupersession> = {};

  for (const correction of corrections) {
    if (!isAppliedCorrection(correction)) continue;
    supersessionIndex[correction.supersedesTruthId] = {
      correctionId: correction.correctionId,
      ledgerRecordId: correction.ledgerRecordId,
      supersedesTruthId: correction.supersedesTruthId,
      replacementTruthId: correction.replacementTruthId
    };
  }

  const supersededTruthIds = Object.keys(supersessionIndex);
  const supersededTruthIdSet = new Set(supersededTruthIds);
  const latestByCandidateId: Record<string, string> = {};
  const conflictIndex: Record<string, string[]> = {};
  const rejectedCandidateIds: string[] = [];

  for (const record of snapshotRecords) {
    if (record.truthState === "CONFLICTED") {
      conflictIndex[record.candidateId] = [
        ...(conflictIndex[record.candidateId] ?? []),
        record.ledgerRecordId
      ];
    }
    if (record.truthState === "REJECTED") {
      rejectedCandidateIds.push(record.candidateId);
    }
    if (!supersededTruthIdSet.has(record.truthId)) {
      latestByCandidateId[record.candidateId] = record.ledgerRecordId;
    }
  }

  const activeTruthIds = snapshotRecords
    .map((record) => record.truthId)
    .filter((truthId) => !supersededTruthIdSet.has(truthId));

  return {
    doctrineVersion: records.at(-1)?.doctrineVersion ?? "core-v1",
    rootHash: replay.rootHash,
    replaySignature: replay.replaySignature,
    recordCount: records.length,
    records: snapshotRecords,
    corrections,
    supersessionIndex,
    supersededTruthIds,
    activeTruthIds,
    latestByCandidateId,
    conflictIndex,
    rejectedCandidateIds
  };
}

export function verifyTruthSnapshotInvariants(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): TruthSnapshotVerification {
  const replay = replayLedger(records);
  const issues = [...replay.issues];
  const truthById = new Map<string, { index: number; ledgerRecordId: string }>();
  const correctionState = new Map<
    string,
    {
      requested?: TruthSnapshotCorrection;
      approved?: TruthSnapshotCorrection;
      rejected?: TruthSnapshotCorrection;
      applied?: TruthSnapshotCorrection;
    }
  >();
  const supersededTruthIds = new Map<string, TruthSnapshotCorrection>();

  for (let index = 0; index < records.length; index += 1) {
    const truth = eventRecord(records[index]);
    if (truth) {
      truthById.set(truth.truthId, {
        index,
        ledgerRecordId: truth.ledgerRecordId
      });
    }
  }

  for (let index = 0; index < records.length; index += 1) {
    const correction = correctionRecord(records[index]);
    if (!correction) continue;

    const state = correctionState.get(correction.correctionId) ?? {};
    correctionState.set(correction.correctionId, state);

    if (correction.correctionType === "CorrectionRequested") {
      if (state.requested) {
        issues.push(
          `correction ${correction.correctionId}: duplicate request event`
        );
      }
      state.requested = correction;
    }

    if (correction.correctionType === "CorrectionApproved") {
      if (!state.requested) {
        issues.push(
          `correction ${correction.correctionId}: approval requires prior request`
        );
      }
      if (state.rejected) {
        issues.push(
          `correction ${correction.correctionId}: approval cannot follow rejection`
        );
      }
      if (state.approved) {
        issues.push(
          `correction ${correction.correctionId}: duplicate approval event`
        );
      }
      state.approved = correction;
    }

    if (correction.correctionType === "CorrectionRejected") {
      if (!state.requested) {
        issues.push(
          `correction ${correction.correctionId}: rejection requires prior request`
        );
      }
      if (state.approved) {
        issues.push(
          `correction ${correction.correctionId}: rejection cannot follow approval`
        );
      }
      state.rejected = correction;
    }

    if (correction.correctionType === "CorrectionApplied") {
      if (!state.requested) {
        issues.push(
          `correction ${correction.correctionId}: apply requires prior request`
        );
      }
      if (!state.approved) {
        issues.push(
          `correction ${correction.correctionId}: apply requires approval`
        );
      }
      if (state.rejected) {
        issues.push(
          `correction ${correction.correctionId}: rejected correction cannot apply`
        );
      }
      if (state.applied) {
        issues.push(
          `correction ${correction.correctionId}: duplicate apply event`
        );
      }
      if (!isAppliedCorrection(correction)) {
        issues.push(
          `correction ${correction.correctionId}: applied correction missing supersession ids`
        );
      } else {
        const superseded = truthById.get(correction.supersedesTruthId);
        const replacement = truthById.get(correction.replacementTruthId);

        if (correction.supersedesTruthId === correction.replacementTruthId) {
          issues.push(
            `correction ${correction.correctionId}: replacement must differ from superseded truth`
          );
        }
        if (!superseded) {
          issues.push(
            `correction ${correction.correctionId}: superseded truth does not exist`
          );
        } else if (superseded.index >= index) {
          issues.push(
            `correction ${correction.correctionId}: superseded truth must be prior ledger history`
          );
        }
        if (!replacement) {
          issues.push(
            `correction ${correction.correctionId}: replacement truth does not exist`
          );
        } else if (replacement.index >= index) {
          issues.push(
            `correction ${correction.correctionId}: replacement truth must be prior ledger history`
          );
        }
        if (supersededTruthIds.has(correction.supersedesTruthId)) {
          issues.push(
            `correction ${correction.correctionId}: truth already superseded`
          );
        } else {
          supersededTruthIds.set(correction.supersedesTruthId, correction);
        }
      }
      state.applied = correction;
    }

    if (correction.correctionType === "CorrectionSuperseded") {
      if (!state.applied) {
        issues.push(
          `correction ${correction.correctionId}: supersede requires prior apply`
        );
      }
      if (correction.supersededByCorrectionId === correction.correctionId) {
        issues.push(
          `correction ${correction.correctionId}: cannot supersede itself`
        );
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function verifyTruthSnapshotRecords(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): TruthSnapshotVerification {
  return verifyTruthSnapshotInvariants(records);
}

export function hashTruthSnapshot(snapshot: TruthSnapshot): string {
  return stableHash(snapshot);
}
