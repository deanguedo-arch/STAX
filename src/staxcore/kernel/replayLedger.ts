import { stableHash } from "../shared/id.js";
import { hashExistingLedgerRecord } from "./hashLedgerRecord.js";
import type { KernelLedgerRecord } from "./types.js";

export interface KernelLedgerReplayRecord {
  id: string;
  doctrineVersion: string;
  previousHash: string | null;
  storedHash: string;
  recomputedHash: string;
  sequence: number;
  recordedAt: string;
}

export interface KernelLedgerReplayResult {
  valid: boolean;
  issues: string[];
  replaySignature: string;
  rootHash: string | null;
  recomputedRootHash: string | null;
  recordCount: number;
  recordHashes: string[];
  recomputedHashes: string[];
  records: KernelLedgerReplayRecord[];
}

function recordIssue(record: KernelLedgerRecord<unknown>, issue: string): string {
  return `entry ${record.sequence} (${record.id}): ${issue}`;
}

export function replayLedger<T>(
  records: readonly KernelLedgerRecord<T>[]
): KernelLedgerReplayResult {
  const issues: string[] = [];
  const seenIds = new Set<string>();
  const replayRecords: KernelLedgerReplayRecord[] = [];
  const recomputedHashes: string[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const expectedSequence = index + 1;
    const previous = index === 0 ? null : records[index - 1];
    const recomputedHash = hashExistingLedgerRecord(record);

    replayRecords.push({
      id: record.id,
      doctrineVersion: record.doctrineVersion,
      previousHash: record.previousHash,
      storedHash: record.hash,
      recomputedHash,
      sequence: record.sequence,
      recordedAt: record.recordedAt
    });
    recomputedHashes.push(recomputedHash);

    if (seenIds.has(record.id)) {
      issues.push(recordIssue(record, "duplicate record id"));
    }
    seenIds.add(record.id);

    if (record.sequence !== expectedSequence) {
      issues.push(recordIssue(record, `sequence must be ${expectedSequence}`));
    }

    if (record.previousHash !== (previous?.hash ?? null)) {
      issues.push(recordIssue(record, "previousHash mismatch"));
    }

    if (record.hash !== recomputedHash) {
      issues.push(recordIssue(record, "stored hash mismatch"));
    }
  }

  const recordHashes = records.map((record) => record.hash);
  const rootHash = recordHashes.at(-1) ?? null;
  const recomputedRootHash = recomputedHashes.at(-1) ?? null;
  const replaySignature = stableHash({
    type: "stax.kernel.ledger.replay.v1",
    rootHash,
    recomputedRootHash,
    recordCount: records.length,
    records: replayRecords
  });

  return {
    valid: issues.length === 0,
    issues,
    replaySignature,
    rootHash,
    recomputedRootHash,
    recordCount: records.length,
    recordHashes,
    recomputedHashes,
    records: replayRecords
  };
}
