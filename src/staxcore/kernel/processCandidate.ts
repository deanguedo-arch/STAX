import type { EventCandidate } from "../types/index.js";
import { KernelAppendOnlyLedger } from "./appendOnlyLedger.js";
import { validateCandidate } from "./validateCandidate.js";
import type {
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

export function processCandidate(
  candidate: EventCandidate,
  ledger = new KernelAppendOnlyLedger<KernelLedgerEvent>()
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
