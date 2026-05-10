import { describe, expect, it } from "vitest";
import type {
  EventCandidate,
  KernelLedgerEvent,
  KernelLedgerRecord
} from "../../../src/staxcore/index.js";
import {
  KernelAppendOnlyLedger,
  processCandidate,
  replayLedger
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function candidate(
  id: string,
  overrides: Partial<EventCandidate> = {}
): EventCandidate {
  return {
    id,
    rawId: `raw-${id}`,
    claim: `Measured observation ${id}.`,
    state: "CANDIDATE",
    provenance: measurementProvenance,
    uncertaintyReason: [],
    missingData: [],
    confidenceCaps: [],
    unresolvedConflicts: [],
    ...overrides
  };
}

function recordsForReplay(): readonly KernelLedgerRecord<KernelLedgerEvent>[] {
  const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
  processCandidate(candidate("candidate-1"), ledger);
  processCandidate(candidate("candidate-2"), ledger);
  return ledger.all();
}

function cloneRecords(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): KernelLedgerRecord<KernelLedgerEvent>[] {
  return JSON.parse(JSON.stringify(records)) as KernelLedgerRecord<KernelLedgerEvent>[];
}

describe("staxcore kernel replay ledger", () => {
  it("replays a valid kernel ledger with an explicit deterministic signature", () => {
    const records = recordsForReplay();
    const first = replayLedger(records);
    const second = replayLedger(cloneRecords(records));

    expect(first.valid).toBe(true);
    expect(first.issues).toEqual([]);
    expect(first.recordCount).toBe(2);
    expect(first.rootHash).toBe(records.at(-1)?.hash);
    expect(first.recomputedRootHash).toBe(records.at(-1)?.hash);
    expect(first.replaySignature).toMatch(/^[a-f0-9]{64}$/);
    expect(second.replaySignature).toBe(first.replaySignature);
  });

  it("changes the replay signature when ledger authority changes", () => {
    const records = recordsForReplay();
    const changed = cloneRecords(records);
    changed[1].previousHash = "0".repeat(64);

    const originalReplay = replayLedger(records);
    const changedReplay = replayLedger(changed);

    expect(changedReplay.valid).toBe(false);
    expect(changedReplay.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("previousHash mismatch"),
        expect.stringContaining("stored hash mismatch")
      ])
    );
    expect(changedReplay.replaySignature).not.toBe(
      originalReplay.replaySignature
    );
  });

  it("changes the replay signature when record content is tampered", () => {
    const records = recordsForReplay();
    const tampered = cloneRecords(records);
    const first = tampered[0];

    if (first.event.type === "validated_event") {
      first.event.event.claim = "Tampered claim.";
    }

    const originalReplay = replayLedger(records);
    const tamperedReplay = replayLedger(tampered);

    expect(tamperedReplay.valid).toBe(false);
    expect(tamperedReplay.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("stored hash mismatch")])
    );
    expect(tamperedReplay.replaySignature).not.toBe(
      originalReplay.replaySignature
    );
  });

  it("detects duplicate ids and sequence gaps during replay", () => {
    const records = cloneRecords(recordsForReplay());
    records[1].id = records[0].id;
    records[1].sequence = 3;

    const replay = replayLedger(records);

    expect(replay.valid).toBe(false);
    expect(replay.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate record id"),
        expect.stringContaining("sequence must be 2"),
        expect.stringContaining("stored hash mismatch")
      ])
    );
  });
});
