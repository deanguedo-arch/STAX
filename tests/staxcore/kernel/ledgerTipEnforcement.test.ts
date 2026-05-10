import { describe, expect, it } from "vitest";
import {
  hashLedgerRecord,
  KernelDurableLedger,
  type KernelLedgerRecord
} from "../../../src/staxcore/index.js";

type TestEvent = Record<string, unknown>;

function recordFor(input: {
  id: string;
  previousHash: string | null;
  sequence: number;
  event: TestEvent;
}): KernelLedgerRecord<TestEvent> {
  const doctrineVersion = "core-v1";
  const recordedAt = "2026-05-10T00:01:00.000Z";
  const hash = hashLedgerRecord({
    id: input.id,
    doctrineVersion,
    previousHash: input.previousHash,
    sequence: input.sequence,
    recordedAt,
    event: input.event
  });

  return {
    id: input.id,
    doctrineVersion,
    previousHash: input.previousHash,
    hash,
    sequence: input.sequence,
    recordedAt,
    event: input.event
  };
}

describe("staxcore kernel durable ledger tip enforcement", () => {
  it("requires callers to provide an expected tip hash", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");

    expect(() =>
      ledger.append(
        { type: "validated_event", eventId: "event-1" },
        { expectedTipHash: undefined as unknown as null }
      )
    ).toThrow(/requires expectedTipHash/);
  });

  it("requires null as the expected tip for the first append", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");

    expect(() =>
      ledger.append(
        { type: "validated_event", eventId: "event-1" },
        {
          expectedTipHash: "not-null",
          id: "record-1",
          recordedAt: "2026-05-10T00:00:00.000Z"
        }
      )
    ).toThrow(/Stale kernel ledger tip/);

    expect(
      ledger.append(
        { type: "validated_event", eventId: "event-1" },
        {
          expectedTipHash: null,
          id: "record-1",
          recordedAt: "2026-05-10T00:00:00.000Z"
        }
      ).sequence
    ).toBe(1);
  });

  it("rejects stale tip appends", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");
    const first = ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );

    expect(() =>
      ledger.append(
        { type: "validated_event", eventId: "event-2" },
        {
          expectedTipHash: null,
          id: "record-2",
          recordedAt: "2026-05-10T00:01:00.000Z"
        }
      )
    ).toThrow(new RegExp(first.hash));
  });

  it("rejects records that do not extend the current tip", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");
    const first = ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );
    const nonTipRecord = recordFor({
      id: "record-2",
      previousHash: null,
      sequence: 2,
      event: { type: "validated_event", eventId: "event-2" }
    });

    expect(() =>
      ledger.appendRecord(nonTipRecord, { expectedTipHash: first.hash })
    ).toThrow(/does not extend current tip/);
  });

  it("rejects duplicate record ids", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");
    const first = ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );
    const duplicate = recordFor({
      id: "record-1",
      previousHash: first.hash,
      sequence: 2,
      event: { type: "validated_event", eventId: "event-2" }
    });

    expect(() =>
      ledger.appendRecord(duplicate, { expectedTipHash: first.hash })
    ).toThrow(/Duplicate kernel ledger record id/);
  });

  it("rejects skipped or reordered sequence numbers", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");
    const first = ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );

    expect(() =>
      ledger.appendRecord(
        recordFor({
          id: "record-3",
          previousHash: first.hash,
          sequence: 3,
          event: { type: "validated_event", eventId: "event-3" }
        }),
        { expectedTipHash: first.hash }
      )
    ).toThrow(/sequence must be 2/);

    expect(() =>
      ledger.appendRecord(
        recordFor({
          id: "record-0",
          previousHash: first.hash,
          sequence: 1,
          event: { type: "validated_event", eventId: "event-0" }
        }),
        { expectedTipHash: first.hash }
      )
    ).toThrow(/sequence must be 2/);
  });

  it("rejects records when the stored hash does not recompute exactly", () => {
    const ledger = new KernelDurableLedger<TestEvent>("memory://ledger");
    const first = ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );
    const tampered = {
      ...recordFor({
        id: "record-2",
        previousHash: first.hash,
        sequence: 2,
        event: { type: "validated_event", eventId: "event-2" }
      }),
      hash: "tampered"
    };

    expect(() =>
      ledger.appendRecord(tampered, { expectedTipHash: first.hash })
    ).toThrow(/hash does not match stored content/);
  });
});
