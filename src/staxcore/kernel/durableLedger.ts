import fs from "node:fs/promises";
import path from "node:path";
import { stableHash } from "../shared/id.js";
import { hashExistingLedgerRecord, hashLedgerRecord } from "./hashLedgerRecord.js";
import { replayLedger } from "./replayLedger.js";
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

export interface KernelDurableLedgerSnapshot<T> {
  version: 1;
  records: KernelLedgerRecord<T>[];
}

export interface KernelDurableLedgerAppendOptions {
  expectedTipHash: string | null;
  doctrineVersion?: string;
  id?: string;
  recordedAt?: string;
}

export interface KernelDurableLedgerRecordAppendOptions {
  expectedTipHash: string | null;
}

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

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function assertSnapshot<T>(
  value: unknown
): asserts value is KernelDurableLedgerSnapshot<T> {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { records?: unknown }).records)
  ) {
    throw new Error("Invalid durable kernel ledger snapshot.");
  }
}

function formatTip(hash: string | null): string {
  return hash ?? "null";
}

export class KernelDurableLedger<
  T extends JsonValue | Record<string, unknown>
> {
  private readonly entries: Array<KernelLedgerRecord<T>>;

  constructor(
    private readonly filePath: string,
    records: readonly KernelLedgerRecord<T>[] = []
  ) {
    this.entries = records.map((record) => deepFreeze(cloneJson(record)));
    this.assertValidChain(this.entries);
  }

  static async load<T extends JsonValue | Record<string, unknown>>(
    filePath: string
  ): Promise<KernelDurableLedger<T>> {
    try {
      const snapshot = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      assertSnapshot<T>(snapshot);
      return new KernelDurableLedger<T>(filePath, snapshot.records);
    } catch (error) {
      if (isNotFound(error)) return new KernelDurableLedger<T>(filePath);
      throw error;
    }
  }

  append(event: T, options: KernelDurableLedgerAppendOptions): KernelLedgerRecord<T> {
    this.assertExpectedTip(options.expectedTipHash);

    const doctrineVersion =
      options.doctrineVersion ?? STAX_KERNEL_DOCTRINE_VERSION;
    const previousHash = this.tipHash();
    const sequence = this.entries.length + 1;
    const recordedAt = options.recordedAt ?? "1970-01-01T00:00:00.000Z";
    const frozenEvent = deepFreeze(cloneJson(event));
    const id =
      options.id ??
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

    return this.appendRecord(
      {
        id,
        doctrineVersion,
        previousHash,
        hash,
        sequence,
        recordedAt,
        event: frozenEvent
      },
      { expectedTipHash: options.expectedTipHash }
    );
  }

  appendRecord(
    record: KernelLedgerRecord<T>,
    options: KernelDurableLedgerRecordAppendOptions
  ): KernelLedgerRecord<T> {
    this.assertExpectedTip(options.expectedTipHash);

    if (this.entries.some((entry) => entry.id === record.id)) {
      throw new Error(`Duplicate kernel ledger record id: ${record.id}`);
    }

    const nextRecord = deepFreeze(cloneJson(record));
    const expectedSequence = this.entries.length + 1;
    const currentTip = this.tipHash();

    if (nextRecord.previousHash !== currentTip) {
      throw new Error(
        `Kernel ledger record ${nextRecord.id} does not extend current tip ${formatTip(
          currentTip
        )}.`
      );
    }

    if (nextRecord.sequence !== expectedSequence) {
      throw new Error(
        `Kernel ledger record ${nextRecord.id} sequence must be ${expectedSequence}.`
      );
    }

    const recomputedHash = hashExistingLedgerRecord(nextRecord);
    if (nextRecord.hash !== recomputedHash) {
      throw new Error(
        `Kernel ledger record ${nextRecord.id} hash does not match stored content.`
      );
    }

    this.entries.push(nextRecord);
    return nextRecord;
  }

  all(): readonly KernelLedgerRecord<T>[] {
    return [...this.entries];
  }

  tipHash(): string | null {
    return this.entries.at(-1)?.hash ?? null;
  }

  snapshot(): KernelDurableLedgerSnapshot<T> {
    return {
      version: 1,
      records: this.entries.map((entry) => cloneJson(entry))
    };
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(this.snapshot(), null, 2)}\n`,
      "utf8"
    );
    await fs.rename(temporaryPath, this.filePath);
  }

  verifyChain(): { valid: boolean; issues: string[] } {
    const replay = replayLedger(this.entries);
    return { valid: replay.valid, issues: replay.issues };
  }

  private assertExpectedTip(expectedTipHash: string | null | undefined): void {
    if (expectedTipHash === undefined) {
      throw new Error("Kernel ledger append requires expectedTipHash.");
    }

    const currentTip = this.tipHash();
    if (expectedTipHash !== currentTip) {
      throw new Error(
        `Stale kernel ledger tip: expected ${formatTip(
          expectedTipHash
        )}, current tip is ${formatTip(currentTip)}.`
      );
    }
  }

  private assertValidChain(records: readonly KernelLedgerRecord<T>[]): void {
    const replay = replayLedger(records);
    if (!replay.valid) throw new Error(replay.issues.join("; "));
  }
}
