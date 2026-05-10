import { stableHash } from "../shared/id.js";
import { hashExistingLedgerRecord, hashLedgerRecord } from "./hashLedgerRecord.js";
import {
  STAX_KERNEL_DOCTRINE_VERSION,
  type KernelLedgerRecord
} from "./types.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export class KernelAppendOnlyLedger<T extends JsonValue | Record<string, unknown>> {
  private readonly entries: Array<KernelLedgerRecord<T>> = [];

  append(
    event: T,
    options?: {
      doctrineVersion?: string;
      id?: string;
      recordedAt?: string;
    }
  ): KernelLedgerRecord<T> {
    const doctrineVersion =
      options?.doctrineVersion ?? STAX_KERNEL_DOCTRINE_VERSION;
    const previousHash = this.entries.at(-1)?.hash ?? null;
    const sequence = this.entries.length + 1;
    const recordedAt = options?.recordedAt ?? "1970-01-01T00:00:00.000Z";
    const frozenEvent = deepFreeze(cloneJson(event));
    const id =
      options?.id ??
      `kernel_ledger_${stableHash({
        doctrineVersion,
        previousHash,
        sequence,
        recordedAt,
        event: frozenEvent
      }).slice(0, 16)}`;
    const hash = hashLedgerRecord({
      id,
      doctrineVersion,
      previousHash,
      sequence,
      recordedAt,
      event: frozenEvent
    });
    const record = deepFreeze({
      id,
      doctrineVersion,
      previousHash,
      hash,
      sequence,
      recordedAt,
      event: frozenEvent
    });

    this.entries.push(record);
    return record;
  }

  all(): readonly KernelLedgerRecord<T>[] {
    return [...this.entries];
  }

  verifyChain(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      const previous = i === 0 ? null : this.entries[i - 1];

      if ((previous?.hash ?? null) !== entry.previousHash) {
        issues.push(`entry ${entry.sequence}: previousHash mismatch`);
      }

      const recomputedHash = hashExistingLedgerRecord(entry);
      if (recomputedHash !== entry.hash) {
        issues.push(`entry ${entry.sequence}: event hash mismatch`);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
