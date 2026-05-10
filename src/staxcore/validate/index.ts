import type {
  ConflictCandidate,
  EventCandidate,
  EventHorizonResult,
  ValidatedEvent
} from "../types/index.js";
import { stableHash } from "../shared/index.js";
import {
  eventHorizonFromKernelDecision,
  validateCandidate
} from "../kernel/index.js";

export function validateConflict(candidate: EventCandidate): ConflictCandidate | null {
  if (candidate.unresolvedConflicts.length === 0) {
    return null;
  }
  return {
    id: `conflict_${stableHash({
      candidateId: candidate.id,
      unresolvedConflicts: candidate.unresolvedConflicts
    }).slice(0, 20)}`,
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
  return eventHorizonFromKernelDecision(candidate, validateCandidate(candidate));
}

export function validateEventCandidate(candidate: EventCandidate): ValidatedEvent {
  return validateEventHorizon(candidate).validation;
}
