export type CorrectionEventType =
  | "CorrectionRequested"
  | "CorrectionApproved"
  | "CorrectionRejected"
  | "CorrectionApplied"
  | "CorrectionSuperseded";

export interface CorrectionEventBase {
  eventId: string;
  type: CorrectionEventType;
  correctionId: string;
  createdAt: string;
  relatedValidationId: string;
  actor: string;
  reason: string;
}

export interface CorrectionRequestedEvent extends CorrectionEventBase {
  type: "CorrectionRequested";
}

export interface CorrectionApprovedEvent extends CorrectionEventBase {
  type: "CorrectionApproved";
  approved: true;
}

export interface CorrectionRejectedEvent extends CorrectionEventBase {
  type: "CorrectionRejected";
  approved: false;
}

export interface CorrectionAppliedEvent extends CorrectionEventBase {
  type: "CorrectionApplied";
  supersedesValidationId: string;
  replacementValidationId: string;
}

export interface CorrectionSupersededEvent extends CorrectionEventBase {
  type: "CorrectionSuperseded";
  supersededByCorrectionId: string;
}

export type CorrectionEvent =
  | CorrectionRequestedEvent
  | CorrectionApprovedEvent
  | CorrectionRejectedEvent
  | CorrectionAppliedEvent
  | CorrectionSupersededEvent;
