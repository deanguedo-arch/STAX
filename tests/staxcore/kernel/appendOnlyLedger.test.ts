import { describe, expect, it } from "vitest";
import {
  hashLedgerEvent,
  KernelAppendOnlyLedger
} from "../../../src/staxcore/index.js";

describe("staxcore kernel append-only ledger", () => {
  it("appends corrections as new records without mutating prior events", () => {
    const ledger = new KernelAppendOnlyLedger();
    const original = ledger.append(
      { type: "validated_event", eventId: "event-1", state: "VALIDATED" },
      { recordedAt: "2026-04-29T00:00:00.000Z" }
    );
    const correction = ledger.append(
      {
        type: "correction_event",
        eventId: "event-2",
        supersedes: "event-1"
      },
      { recordedAt: "2026-04-29T00:01:00.000Z" }
    );

    expect(ledger.all()).toHaveLength(2);
    expect(correction.previousHash).toBe(original.hash);
    expect(ledger.all()[0].event).toEqual({
      type: "validated_event",
      eventId: "event-1",
      state: "VALIDATED"
    });
    expect(ledger.verifyChain().valid).toBe(true);
  });

  it("freezes records so old events cannot be overwritten through references", () => {
    const ledger = new KernelAppendOnlyLedger();
    ledger.append(
      { type: "validated_event", eventId: "event-1", state: "VALIDATED" },
      { recordedAt: "2026-04-29T00:00:00.000Z" }
    );

    const first = ledger.all()[0] as unknown as {
      event: { eventId: string };
    };

    expect(() => {
      first.event.eventId = "mutated";
    }).toThrow();
    expect(ledger.all()[0].event).toEqual({
      type: "validated_event",
      eventId: "event-1",
      state: "VALIDATED"
    });
  });

  it("changes hashes when event content changes", () => {
    const first = hashLedgerEvent({
      type: "validated_event",
      eventId: "event-1"
    });
    const second = hashLedgerEvent({
      type: "validated_event",
      eventId: "event-2"
    });

    expect(second).not.toBe(first);
  });
});
