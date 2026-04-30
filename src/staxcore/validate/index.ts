import type {
  CandidateRejectionReason,
  ConflictCandidate,
  EventCandidate,
  EventHorizonResult,
  ValidatedEvent,
  WarningCode
} from "../types/index.js";
import { createId, inspectInput } from "../shared/index.js";

function mapReasonsToWarnings(
  reasons: CandidateRejectionReason[]
): WarningCode[] {
  const warnings: WarningCode[] = [];
  for (const reason of reasons) {
    switch (reason) {
      case "insufficientEvidence":
        warnings.push("MISSING_DATA");
        warnings.push("LOW_CONFIDENCE");
        break;
      case "contradictoryEvidence":
        warnings.push("CONFLICT_DETECTED");
        break;
      case "invalidSource":
        warnings.push("MISSING_PROVENANCE");
        break;
      case "malformedInput":
        warnings.push("UNSAFE_INPUT");
        break;
      case "interpretationDetected":
        warnings.push("OPINION_DETECTED");
        break;
      case "recommendationDetected":
        warnings.push("RECOMMENDATION_DETECTED");
        break;
    }
  }
  return warnings;
}

function uniqueWarnings(warnings: WarningCode[]): WarningCode[] {
  return [...new Set(warnings)];
}

export function validateConflict(candidate: EventCandidate): ConflictCandidate | null {
  if (candidate.unresolvedConflicts.length === 0) {
    return null;
  }
  return {
    id: createId("conflict"),
    candidateId: candidate.id,
    severity: candidate.unresolvedConflicts.length > 1 ? "high" : "medium",
    sourceMap: candidate.unresolvedConflicts,
    status: "open"
  };
}

export function validateEvidenceChain(candidate: EventCandidate): boolean {
  const hasSource = Boolean(candidate.provenance.sourceId);
  const hasReference = Boolean(candidate.provenance.rawReference);
  const hasCaptureActor = Boolean(candidate.provenance.capturedBy);
  return hasSource && hasReference && hasCaptureActor;
}

export function rejectUnsupportedTruth(candidate: EventCandidate): boolean {
  return (
    candidate.provenance.sourceType === "opinion" ||
    candidate.provenance.sourceType === "recommendation"
  );
}

export function validateEventHorizon(candidate: EventCandidate): EventHorizonResult {
  const rejectionReasons: CandidateRejectionReason[] = [];
  const baseWarnings: WarningCode[] = [...inspectInput(candidate.claim)];

  if (candidate.claim.trim().length === 0) {
    rejectionReasons.push("malformedInput");
  }
  if (!validateEvidenceChain(candidate)) {
    rejectionReasons.push("insufficientEvidence");
  }
  if (candidate.provenance.sourceType === "unknown") {
    rejectionReasons.push("invalidSource");
  }
  if (candidate.provenance.sourceType === "opinion") {
    rejectionReasons.push("interpretationDetected");
  }
  if (candidate.provenance.sourceType === "recommendation") {
    rejectionReasons.push("recommendationDetected");
  }
  if (candidate.provenance.sourceType === "ai_extraction") {
    baseWarnings.push("AI_EXTRACTION_LIMIT");
  }
  if (candidate.provenance.trustLevel < 0.5) {
    baseWarnings.push("LOW_CONFIDENCE");
  }
  if (candidate.missingData.length > 0) {
    rejectionReasons.push("insufficientEvidence");
  }

  const conflict = validateConflict(candidate);
  if (conflict) {
    rejectionReasons.push("contradictoryEvidence");
  }

  const warnings = uniqueWarnings([
    ...baseWarnings,
    ...mapReasonsToWarnings(rejectionReasons)
  ]);

  const state = rejectionReasons.some((reason) =>
    ["malformedInput", "invalidSource", "interpretationDetected", "recommendationDetected"].includes(
      reason
    )
  )
    ? "REJECTED"
    : conflict
      ? "CONFLICTED"
      : "VALIDATED";

  const validation: ValidatedEvent = {
    id: createId("validation"),
    candidateId: candidate.id,
    claim: candidate.claim,
    sourceId: candidate.provenance.sourceId,
    sourceType: candidate.provenance.sourceType,
    evidenceChainValid: validateEvidenceChain(candidate),
    missingData: candidate.missingData,
    confidenceCaps: candidate.confidenceCaps,
    state,
    warnings
  };

  return {
    validation,
    rejectionReasons,
    conflict,
    evidenceChainValid: validateEvidenceChain(candidate),
    uncertainty: {
      uncertaintyReason: candidate.uncertaintyReason,
      missingData: candidate.missingData,
      confidenceCaps: candidate.confidenceCaps,
      unresolvedConflicts: candidate.unresolvedConflicts
    }
  };
}

export function validateEventCandidate(candidate: EventCandidate): ValidatedEvent {
  return validateEventHorizon(candidate).validation;
}
