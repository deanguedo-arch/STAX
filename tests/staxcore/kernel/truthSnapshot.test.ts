import { describe, expect, it } from "vitest";
import type {
  EventCandidate,
  KernelLedgerEvent,
  KernelLedgerRecord
} from "../../../src/staxcore/index.js";
import {
  buildTruthSnapshot,
  hashTruthSnapshot,
  KernelAppendOnlyLedger,
  processCandidate,
  replayLedger,
  verifyTruthSnapshotRecords
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

function cloneRecords(
  records: readonly KernelLedgerRecord<KernelLedgerEvent>[]
): KernelLedgerRecord<KernelLedgerEvent>[] {
  return JSON.parse(JSON.stringify(records)) as KernelLedgerRecord<KernelLedgerEvent>[];
}

describe("truth snapshot", () => {
  it("builds a durable snapshot with latest, conflict, and rejection indexes", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    const accepted = processCandidate(candidate("candidate-accepted"), ledger);
    const conflicted = processCandidate(
      candidate("candidate-conflicted", {
        unresolvedConflicts: ["source-a:complete vs source-b:incomplete"]
      }),
      ledger
    );
    processCandidate(
      candidate("candidate-rejected", {
        provenance: {
          ...measurementProvenance,
          sourceType: "recommendation"
        }
      }),
      ledger
    );

    const snapshot = buildTruthSnapshot(ledger.all());

    expect(snapshot.recordCount).toBe(3);
    expect(snapshot.rootHash).toBe(ledger.all().at(-1)?.hash);
    expect(snapshot.replaySignature).toBe(
      replayLedger(ledger.all()).replaySignature
    );
    expect(snapshot.latestByCandidateId["candidate-accepted"]).toBe(
      accepted.ledgerRecord.id
    );
    expect(snapshot.conflictIndex["candidate-conflicted"]).toEqual([
      conflicted.ledgerRecord.id
    ]);
    expect(snapshot.rejectedCandidateIds).toContain("candidate-rejected");
  });

  it("verifies replayed ledger records and detects tampering", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    processCandidate(candidate("candidate-accepted"), ledger);
    const records = ledger.all();
    const tampered = cloneRecords(records);
    const first = tampered[0];

    expect(verifyTruthSnapshotRecords(records)).toEqual({
      valid: true,
      issues: []
    });

    if (first.event.type === "validated_event") {
      first.event.event.claim = "Tampered claim.";
    }

    expect(verifyTruthSnapshotRecords(tampered).valid).toBe(false);
  });

  it("hashes snapshots deterministically", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    processCandidate(candidate("candidate-accepted"), ledger);

    expect(hashTruthSnapshot(buildTruthSnapshot(ledger.all()))).toBe(
      hashTruthSnapshot(buildTruthSnapshot(ledger.all()))
    );
  });
});
