import type { Provenance, SourceType } from "./provenance.js";
import type { TruthState, WarningCode } from "./core.js";

export interface RawObservation {
  id: string;
  content: string;
  provenance: Provenance;
  receivedAt: string;
}

export interface EventCandidate {
  id: string;
  rawId: string;
  claim: string;
  state: TruthState;
  provenance: Provenance;
  uncertaintyReason: string[];
  missingData: string[];
  confidenceCaps: string[];
  unresolvedConflicts: string[];
}

export interface ValidatedEvent {
  id: string;
  candidateId: string;
  claim: string;
  state: TruthState;
  sourceId: string;
  sourceType: SourceType;
  evidenceChainValid: boolean;
  missingData: string[];
  confidenceCaps: string[];
  warnings: WarningCode[];
}

export type CandidateRejectionReason =
  | "insufficientEvidence"
  | "contradictoryEvidence"
  | "invalidSource"
  | "malformedInput"
  | "interpretationDetected"
  | "recommendationDetected";

export type ConflictSeverity = "low" | "medium" | "high";
export type ConflictResolutionStatus = "open" | "resolved";

export interface ConflictCandidate {
  id: string;
  candidateId: string;
  severity: ConflictSeverity;
  sourceMap: string[];
  status: ConflictResolutionStatus;
}

export interface EventHorizonResult {
  validation: ValidatedEvent;
  rejectionReasons: CandidateRejectionReason[];
  conflict: ConflictCandidate | null;
  evidenceChainValid: boolean;
  uncertainty: {
    uncertaintyReason: string[];
    missingData: string[];
    confidenceCaps: string[];
    unresolvedConflicts: string[];
  };
}
