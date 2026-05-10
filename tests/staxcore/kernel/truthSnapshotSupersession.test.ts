import { describe, expect, it } from "vitest";
import type {
  CorrectionEvent,
  EventCandidate,
  KernelLedgerEvent,
  KernelLedgerRecord
} from "../../../src/staxcore/index.js";
import {
  buildTruthSnapshot,
  createCorrectionApplied,
  createCorrectionDecision,
  createCorrectionRequested,
  KernelAppendOnlyLedger,
  processCandidate,
  verifyTruthSnapshotInvariants
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function candidate(id: string): EventCandidate {
  return {
    id,
    rawId: `raw-${id}`,
    claim: `Measured observation ${id}.`,
    state: "CANDIDATE",
    provenance: measurementProvenance,
    uncertaintyReason: [],
    missingData: [],
    confidenceCaps: [],
    unresolvedConflicts: []
  };
}

function appendCorrection(
  ledger: KernelAppendOnlyLedger<KernelLedgerEvent>,
  correction: CorrectionEvent
): KernelLedgerRecord<KernelLedgerEvent> {
  return ledger.append(
    {
      type: "correction_event",
      correction,
      doctrineVersion: "core-v1",
      auditRefs: [`correction:${correction.correctionId}`]
    },
    { recordedAt: correction.createdAt }
  );
}

function appendApprovedCorrection(
  ledger: KernelAppendOnlyLedger<KernelLedgerEvent>,
  args: {
    correctionId: string;
    supersedesValidationId: string;
    replacementValidationId: string;
  }
): void {
  const request = createCorrectionRequested({
    correctionId: args.correctionId,
    relatedValidationId: args.supersedesValidationId,
    actor: "operator",
    reason: "Correction requested."
  });
  const approved = createCorrectionDecision(request, {
    actor: "reviewer",
    reason: "Evidence supports correction.",
    approved: true
  });
  if (approved.type !== "CorrectionApproved") {
    throw new Error("expected approved correction");
  }
  const applied = createCorrectionApplied(approved, {
    actor: "operator",
    reason: "Apply approved correction.",
    replacementValidationId: args.replacementValidationId
  });

  appendCorrection(ledger, request);
  appendCorrection(ledger, approved);
  appendCorrection(ledger, applied);
}

describe("truth snapshot supersession invariants", () => {
  it("indexes approved corrections without mutating superseded truth", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    const original = processCandidate(candidate("candidate-original"), ledger);
    const replacement = processCandidate(candidate("candidate-replacement"), ledger);

    appendApprovedCorrection(ledger, {
      correctionId: "correction-1",
      supersedesValidationId: original.decision.outcome === "rejected"
        ? "unexpected"
        : original.decision.event.id,
      replacementValidationId: replacement.decision.outcome === "rejected"
        ? "unexpected"
        : replacement.decision.event.id
    });

    const snapshot = buildTruthSnapshot(ledger.all());
    const originalTruthId =
      original.decision.outcome === "rejected"
        ? original.decision.rejection.id
        : original.decision.event.id;
    const replacementTruthId =
      replacement.decision.outcome === "rejected"
        ? replacement.decision.rejection.id
        : replacement.decision.event.id;

    expect(verifyTruthSnapshotInvariants(ledger.all()).valid).toBe(true);
    expect(snapshot.corrections).toHaveLength(3);
    expect(snapshot.supersededTruthIds).toEqual([originalTruthId]);
    expect(snapshot.activeTruthIds).toContain(replacementTruthId);
    expect(snapshot.activeTruthIds).not.toContain(originalTruthId);
    expect(snapshot.supersessionIndex[originalTruthId]).toMatchObject({
      correctionId: "correction-1",
      replacementTruthId
    });
  });

  it("rejects applied corrections that were not approved", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    const original = processCandidate(candidate("candidate-original"), ledger);
    const replacement = processCandidate(candidate("candidate-replacement"), ledger);
    const originalTruthId =
      original.decision.outcome === "rejected"
        ? original.decision.rejection.id
        : original.decision.event.id;
    const replacementTruthId =
      replacement.decision.outcome === "rejected"
        ? replacement.decision.rejection.id
        : replacement.decision.event.id;
    const request = createCorrectionRequested({
      correctionId: "correction-1",
      relatedValidationId: originalTruthId,
      actor: "operator",
      reason: "Correction requested."
    });
    const approved = createCorrectionDecision(request, {
      actor: "reviewer",
      reason: "Evidence supports correction.",
      approved: true
    });
    if (approved.type !== "CorrectionApproved") {
      throw new Error("expected approved correction");
    }
    const applied = createCorrectionApplied(approved, {
      actor: "operator",
      reason: "Apply approved correction.",
      replacementValidationId: replacementTruthId
    });

    appendCorrection(ledger, request);
    appendCorrection(ledger, applied);

    expect(verifyTruthSnapshotInvariants(ledger.all()).issues).toEqual(
      expect.arrayContaining([expect.stringContaining("apply requires approval")])
    );
  });

  it("rejects corrections that reference missing replacement truth", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    const original = processCandidate(candidate("candidate-original"), ledger);
    const originalTruthId =
      original.decision.outcome === "rejected"
        ? original.decision.rejection.id
        : original.decision.event.id;

    appendApprovedCorrection(ledger, {
      correctionId: "correction-1",
      supersedesValidationId: originalTruthId,
      replacementValidationId: "validation_missing"
    });

    expect(verifyTruthSnapshotInvariants(ledger.all()).issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("replacement truth does not exist")
      ])
    );
  });

  it("rejects double supersession of the same truth", () => {
    const ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>();
    const original = processCandidate(candidate("candidate-original"), ledger);
    const replacement1 = processCandidate(candidate("candidate-replacement-1"), ledger);
    const replacement2 = processCandidate(candidate("candidate-replacement-2"), ledger);
    const originalTruthId =
      original.decision.outcome === "rejected"
        ? original.decision.rejection.id
        : original.decision.event.id;
    const replacementTruthId1 =
      replacement1.decision.outcome === "rejected"
        ? replacement1.decision.rejection.id
        : replacement1.decision.event.id;
    const replacementTruthId2 =
      replacement2.decision.outcome === "rejected"
        ? replacement2.decision.rejection.id
        : replacement2.decision.event.id;

    appendApprovedCorrection(ledger, {
      correctionId: "correction-1",
      supersedesValidationId: originalTruthId,
      replacementValidationId: replacementTruthId1
    });
    appendApprovedCorrection(ledger, {
      correctionId: "correction-2",
      supersedesValidationId: originalTruthId,
      replacementValidationId: replacementTruthId2
    });

    expect(verifyTruthSnapshotInvariants(ledger.all()).issues).toEqual(
      expect.arrayContaining([expect.stringContaining("truth already superseded")])
    );
  });
});
