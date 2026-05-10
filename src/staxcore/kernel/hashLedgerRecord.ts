import { stableHash } from "../shared/id.js";
import { STAX_KERNEL_DOCTRINE_VERSION, type KernelLedgerRecord } from "./types.js";

export interface KernelLedgerHashInput<T> {
  id: string;
  doctrineVersion?: string;
  previousHash: string | null;
  sequence: number;
  recordedAt: string;
  event: T;
}

export function hashLedgerEvent(event: unknown): string {
  return stableHash(event);
}

export function hashLedgerRecord<T>(input: KernelLedgerHashInput<T>): string {
  return stableHash({
    id: input.id,
    doctrineVersion: input.doctrineVersion ?? STAX_KERNEL_DOCTRINE_VERSION,
    previousHash: input.previousHash,
    sequence: input.sequence,
    recordedAt: input.recordedAt,
    event: input.event
  });
}

export function hashExistingLedgerRecord<T>(
  record: KernelLedgerRecord<T>
): string {
  return hashLedgerRecord({
    id: record.id,
    doctrineVersion: record.doctrineVersion,
    previousHash: record.previousHash,
    sequence: record.sequence,
    recordedAt: record.recordedAt,
    event: record.event
  });
}
