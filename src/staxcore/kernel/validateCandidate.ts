import { inspectInput, stableHash } from "../shared/index.js";
import type {
  CandidateRejectionReason,
  EventCandidate,
  ValidatedEvent,
  WarningCode
} from "../types/index.js";
import {
  STAX_KERNEL_DOCTRINE_VERSION,
  type KernelValidationDecision,
  type RejectedCandidate
} from "./types.js";

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}_${stableHash(value).slice(0, 20)}`;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function mapReasonsToWarnings(
  reasons: CandidateRejectionReason[]
): WarningCode[] {
  const warnings: WarningCode[] = [];
  for (const reason of reasons) {
    switch (reason) {
      case "insufficientEvidence":
        warnings.push("MISSING_DATA", "LOW_CONFIDENCE");
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

function auditRefsFor(candidate: EventCandidate): string[] {
  return [
    `candidate:${candidate.id}`,
    `raw:${candidate.rawId}`,
    `source:${candidate.provenance.sourceId || "missing"}`,
    `doctrine:${STAX_KERNEL_DOCTRINE_VERSION}`
  ];
}

function evidenceChainValid(candidate: EventCandidate): boolean {
  return Boolean(
    candidate.provenance.sourceId &&
      candidate.provenance.rawReference &&
      candidate.provenance.capturedBy &&
      candidate.provenance.receivedAt
  );
}

function rejectionReasonsFor(candidate: EventCandidate): CandidateRejectionReason[] {
  const reasons: CandidateRejectionReason[] = [];

  if (candidate.claim.trim().length === 0) {
    reasons.push("malformedInput");
  }
  if (!evidenceChainValid(candidate) || candidate.provenance.sourceType === "unknown") {
    reasons.push("invalidSource");
  }
  if (candidate.provenance.trustLevel < 0.5 || candidate.missingData.length > 0) {
    reasons.push("insufficientEvidence");
  }
  if (candidate.provenance.sourceType === "opinion") {
    reasons.push("interpretationDetected");
  }
  if (candidate.provenance.sourceType === "recommendation") {
    reasons.push("recommendationDetected");
  }
  if (candidate.unresolvedConflicts.length > 0) {
    reasons.push("contradictoryEvidence");
  }

  return unique(reasons);
}

function hardRejects(reasons: CandidateRejectionReason[]): boolean {
  return reasons.some((reason) =>
    [
      "malformedInput",
      "invalidSource",
      "interpretationDetected",
      "recommendationDetected"
    ].includes(reason)
  );
}

export function validateCandidate(
  candidate: EventCandidate
): KernelValidationDecision {
  const rejectionReasons = rejectionReasonsFor(candidate);
  const warnings = unique([
    ...inspectInput(candidate.claim),
    ...mapReasonsToWarnings(rejectionReasons),
    ...(candidate.provenance.sourceType === "ai_extraction"
      ? (["AI_EXTRACTION_LIMIT"] as WarningCode[])
      : [])
  ]);
  const auditRefs = auditRefsFor(candidate);
  const chainValid = evidenceChainValid(candidate);

  if (hardRejects(rejectionReasons)) {
    const rejection: RejectedCandidate = {
      id: deterministicId("rejection", {
        candidateId: candidate.id,
        claim: candidate.claim,
        rejectionReasons,
        doctrineVersion: STAX_KERNEL_DOCTRINE_VERSION
      }),
      candidateId: candidate.id,
      claim: candidate.claim,
      state: "REJECTED",
      sourceId: candidate.provenance.sourceId,
      sourceType: candidate.provenance.sourceType,
      evidenceChainValid: chainValid,
      missingData: candidate.missingData,
      confidenceCaps: candidate.confidenceCaps,
      warnings,
      rejectionReasons,
      doctrineVersion: STAX_KERNEL_DOCTRINE_VERSION,
      auditRefs
    };

    return {
      outcome: "rejected",
      rejection,
      rejectionReasons,
      doctrineVersion: STAX_KERNEL_DOCTRINE_VERSION,
      auditRefs
    };
  }

  const state: "CONFLICTED" | "VALIDATED" =
    candidate.unresolvedConflicts.length > 0 ? "CONFLICTED" : "VALIDATED";
  const event: ValidatedEvent = {
    id: deterministicId("validation", {
      candidateId: candidate.id,
      claim: candidate.claim,
      state,
      rejectionReasons,
      doctrineVersion: STAX_KERNEL_DOCTRINE_VERSION
    }),
    candidateId: candidate.id,
    claim: candidate.claim,
    state,
    sourceId: candidate.provenance.sourceId,
    sourceType: candidate.provenance.sourceType,
    evidenceChainValid: chainValid,
    missingData: candidate.missingData,
    confidenceCaps: candidate.confidenceCaps,
    warnings
  };

  return {
    outcome: state === "CONFLICTED" ? "conflicted" : "validated",
    event,
    rejectionReasons,
    doctrineVersion: STAX_KERNEL_DOCTRINE_VERSION,
    auditRefs
  };
}
