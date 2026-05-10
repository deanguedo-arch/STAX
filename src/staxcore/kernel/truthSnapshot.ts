import { stableHash } from "../shared/index.js";
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

export interface TruthSnapshot {
  doctrineVersion: string;
  rootHash: string | null;
  replaySignature: string;
  recordCount: number;
  records: TruthSnapshotRecord[];
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
): TruthSnapshotRecord {
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

export function buildTruthSnapshot(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): TruthSnapshot {
  const replay = replayLedger(records);
  const snapshotRecords = records.map(eventRecord);
  const latestByCandidateId: Record<string, string> = {};
  const conflictIndex: Record<string, string[]> = {};
  const rejectedCandidateIds: string[] = [];

  for (const record of snapshotRecords) {
    latestByCandidateId[record.candidateId] = record.ledgerRecordId;
    if (record.truthState === "CONFLICTED") {
      conflictIndex[record.candidateId] = [
        ...(conflictIndex[record.candidateId] ?? []),
        record.ledgerRecordId
      ];
    }
    if (record.truthState === "REJECTED") {
      rejectedCandidateIds.push(record.candidateId);
    }
  }

  return {
    doctrineVersion: records.at(-1)?.doctrineVersion ?? "core-v1",
    rootHash: replay.rootHash,
    replaySignature: replay.replaySignature,
    recordCount: records.length,
    records: snapshotRecords,
    latestByCandidateId,
    conflictIndex,
    rejectedCandidateIds
  };
}

export function verifyTruthSnapshotRecords(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): TruthSnapshotVerification {
  const replay = replayLedger(records);
  return { valid: replay.valid, issues: replay.issues };
}

export function hashTruthSnapshot(snapshot: TruthSnapshot): string {
  return stableHash(snapshot);
}
