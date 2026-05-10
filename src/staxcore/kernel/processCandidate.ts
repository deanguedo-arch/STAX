import { stableHash } from "../shared/index.js";
import type {
  ConflictCandidate,
  EventCandidate,
  EventHorizonResult,
  ValidatedEvent
} from "../types/index.js";
import { KernelAppendOnlyLedger } from "./appendOnlyLedger.js";
import { validateCandidate } from "./validateCandidate.js";
import type {
  KernelLedgerWriter,
  KernelValidationDecision,
  KernelLedgerEvent,
  ProcessCandidateResult
} from "./types.js";

function ledgerEventFromDecision(
  decision: ReturnType<typeof validateCandidate>
): KernelLedgerEvent {
  if (decision.outcome === "rejected") {
    return {
      type: "rejected_candidate",
      rejection: decision.rejection,
      doctrineVersion: decision.doctrineVersion,
      auditRefs: decision.auditRefs
    };
  }

  return {
    type: decision.outcome === "conflicted" ? "conflicted_event" : "validated_event",
    event: decision.event,
    doctrineVersion: decision.doctrineVersion,
    auditRefs: decision.auditRefs
  };
}

function validationFromDecision(decision: KernelValidationDecision): ValidatedEvent {
  return decision.outcome === "rejected" ? decision.rejection : decision.event;
}

function conflictFromCandidate(
  candidate: EventCandidate,
  decision: KernelValidationDecision
): ConflictCandidate | null {
  if (decision.outcome !== "conflicted") return null;
  return {
    id: `conflict_${stableHash({
      candidateId: candidate.id,
      unresolvedConflicts: candidate.unresolvedConflicts,
      doctrineVersion: decision.doctrineVersion
    }).slice(0, 20)}`,
    candidateId: candidate.id,
    severity: candidate.unresolvedConflicts.length > 1 ? "high" : "medium",
    sourceMap: candidate.unresolvedConflicts,
    status: "open"
  };
}

export function eventHorizonFromKernelDecision(
  candidate: EventCandidate,
  decision: KernelValidationDecision
): EventHorizonResult {
  const validation = validationFromDecision(decision);
  return {
    validation,
    rejectionReasons: decision.rejectionReasons,
    conflict: conflictFromCandidate(candidate, decision),
    evidenceChainValid: validation.evidenceChainValid,
    uncertainty: {
      uncertaintyReason: candidate.uncertaintyReason,
      missingData: candidate.missingData,
      confidenceCaps: candidate.confidenceCaps,
      unresolvedConflicts: candidate.unresolvedConflicts
    }
  };
}

export function eventHorizonFromProcessCandidateResult(
  candidate: EventCandidate,
  result: ProcessCandidateResult
): EventHorizonResult {
  return eventHorizonFromKernelDecision(candidate, result.decision);
}

export function processCandidate(
  candidate: EventCandidate,
  ledger: KernelLedgerWriter<KernelLedgerEvent> =
    new KernelAppendOnlyLedger<KernelLedgerEvent>()
): ProcessCandidateResult {
  const decision = validateCandidate(candidate);
  const ledgerEvent = ledgerEventFromDecision(decision);
  const ledgerRecord = ledger.append(ledgerEvent, {
    recordedAt: candidate.provenance.receivedAt
  });

  return {
    decision,
    ledgerRecord,
    ledgerValid: ledger.verifyChain().valid
  };
}
