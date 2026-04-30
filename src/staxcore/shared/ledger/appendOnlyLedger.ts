import { stableHash } from "../id.js";
import { nowIso } from "../time.js";

export interface LedgerEntry<T> {
  id: string;
  doctrineVersion: string;
  doctrineHash: string;
  previousHash: string | null;
  previousLedgerHash: string | null;
  hash: string;
  ledgerHash: string;
  sequence: number;
  recordedAt: string;
  event: T;
}

export class AppendOnlyLedger<T> {
  private entries: LedgerEntry<T>[] = [];

  append(
    id: string,
    event: T,
    options?: { doctrineVersion?: string }
  ): LedgerEntry<T> {
    const doctrineVersion = options?.doctrineVersion ?? "core-v1";
    const doctrineHash = stableHash({ doctrineVersion });
    const previousHash = this.entries.at(-1)?.hash ?? null;
    const previousLedgerHash = this.entries.at(-1)?.ledgerHash ?? null;
    const hash = stableHash({ id, doctrineHash, previousHash, event });
    const ledgerHash = stableHash({
      previousLedgerHash,
      hash,
      doctrineHash
    });
    const entry = {
      id,
      doctrineVersion,
      doctrineHash,
      previousHash,
      previousLedgerHash,
      hash,
      ledgerHash,
      sequence: this.entries.length + 1,
      recordedAt: nowIso(),
      event
    };
    this.entries.push(entry);
    return entry;
  }

  all(): readonly LedgerEntry<T>[] {
    return this.entries;
  }

  replay(): readonly LedgerEntry<T>[] {
    return this.entries;
  }

  verifyChain(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      const expectedDoctrineHash = stableHash({
        doctrineVersion: entry.doctrineVersion
      });
      if (entry.doctrineHash !== expectedDoctrineHash) {
        issues.push(`entry ${entry.sequence}: doctrineHash mismatch`);
      }

      const previous = i === 0 ? null : this.entries[i - 1];
      if ((previous?.hash ?? null) !== entry.previousHash) {
        issues.push(`entry ${entry.sequence}: previousHash mismatch`);
      }
      if ((previous?.ledgerHash ?? null) !== entry.previousLedgerHash) {
        issues.push(`entry ${entry.sequence}: previousLedgerHash mismatch`);
      }

      const recomputedHash = stableHash({
        id: entry.id,
        doctrineHash: entry.doctrineHash,
        previousHash: entry.previousHash,
        event: entry.event
      });
      if (recomputedHash !== entry.hash) {
        issues.push(`entry ${entry.sequence}: event hash mismatch`);
      }

      const recomputedLedgerHash = stableHash({
        previousLedgerHash: entry.previousLedgerHash,
        hash: entry.hash,
        doctrineHash: entry.doctrineHash
      });
      if (recomputedLedgerHash !== entry.ledgerHash) {
        issues.push(`entry ${entry.sequence}: ledger hash mismatch`);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
