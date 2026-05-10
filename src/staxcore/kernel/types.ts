import type {
  CandidateRejectionReason,
  CorrectionEvent,
  EventCandidate,
  SourceType,
  ValidatedEvent,
  WarningCode
} from "../types/index.js";

export const STAX_KERNEL_DOCTRINE_VERSION = "core-v1";

export type KernelCandidate = EventCandidate;

export interface RejectedCandidate {
  id: string;
  candidateId: string;
  claim: string;
  state: "REJECTED";
  sourceId: string;
  sourceType: SourceType;
  evidenceChainValid: boolean;
  missingData: string[];
  confidenceCaps: string[];
  warnings: WarningCode[];
  rejectionReasons: CandidateRejectionReason[];
  doctrineVersion: string;
  auditRefs: string[];
}

export type KernelValidationDecision =
  | {
      outcome: "validated";
      event: ValidatedEvent;
      rejectionReasons: CandidateRejectionReason[];
      doctrineVersion: string;
      auditRefs: string[];
    }
  | {
      outcome: "conflicted";
      event: ValidatedEvent;
      rejectionReasons: CandidateRejectionReason[];
      doctrineVersion: string;
      auditRefs: string[];
    }
  | {
      outcome: "rejected";
      rejection: RejectedCandidate;
      rejectionReasons: CandidateRejectionReason[];
      doctrineVersion: string;
      auditRefs: string[];
    };

export type KernelLedgerEvent =
  | {
      type: "validated_event";
      event: ValidatedEvent;
      doctrineVersion: string;
      auditRefs: string[];
    }
  | {
      type: "conflicted_event";
      event: ValidatedEvent;
      doctrineVersion: string;
      auditRefs: string[];
    }
  | {
      type: "rejected_candidate";
      rejection: RejectedCandidate;
      doctrineVersion: string;
      auditRefs: string[];
    }
  | {
      type: "correction_event";
      correction: CorrectionEvent;
      doctrineVersion: string;
      auditRefs: string[];
    };

export interface KernelLedgerRecord<T> {
  id: string;
  doctrineVersion: string;
  previousHash: string | null;
  hash: string;
  sequence: number;
  recordedAt: string;
  event: T;
}

export interface ProcessCandidateResult {
  decision: KernelValidationDecision;
  ledgerRecord: KernelLedgerRecord<KernelLedgerEvent>;
  ledgerValid: boolean;
}
