import { describe, expect, it } from "vitest";
import {
  createCorrectionApplied,
  createCorrectionDecision,
  createCorrectionRequested,
  createCorrectionSuperseded,
  isCorrectionSequenceValid
} from "../../src/staxcore/index.js";

describe("staxcore correction loop", () => {
  it("models request -> approve -> apply -> supersede as append-only events", () => {
    const request = createCorrectionRequested({
      relatedValidationId: "validation_1",
      actor: "operator",
      reason: "Source conflict requires correction."
    });
    const approved = createCorrectionDecision(request, {
      actor: "reviewer",
      reason: "Evidence supports correction.",
      approved: true
    });
    if (approved.type !== "CorrectionApproved") {
      throw new Error("expected approved correction decision");
    }
    const applied = createCorrectionApplied(approved, {
      actor: "operator",
      reason: "Applying approved correction.",
      replacementValidationId: "validation_2"
    });
    const superseded = createCorrectionSuperseded(applied, {
      actor: "auditor",
      reason: "Newer correction supersedes this one.",
      supersededByCorrectionId: "correction_newer"
    });

    expect(request.type).toBe("CorrectionRequested");
    expect(approved.type).toBe("CorrectionApproved");
    expect(applied.type).toBe("CorrectionApplied");
    expect(superseded.type).toBe("CorrectionSuperseded");
    expect(
      isCorrectionSequenceValid([request, approved, applied, superseded])
    ).toBe(true);
  });

  it("rejects invalid event order", () => {
    const request = createCorrectionRequested({
      relatedValidationId: "validation_1",
      actor: "operator",
      reason: "Need correction."
    });
    const rejected = createCorrectionDecision(request, {
      actor: "reviewer",
      reason: "Insufficient evidence.",
      approved: false
    });

    expect(isCorrectionSequenceValid([rejected, request])).toBe(false);
  });
});
