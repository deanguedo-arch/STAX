import type {
  CorrectionAppliedEvent,
  CorrectionApprovedEvent,
  CorrectionEvent,
  CorrectionRejectedEvent,
  CorrectionRequestedEvent,
  CorrectionSupersededEvent
} from "../types/index.js";
import { createId, nowIso } from "../shared/index.js";

interface BaseArgs {
  correctionId?: string;
  relatedValidationId: string;
  actor: string;
  reason: string;
}

export function createCorrectionRequested(
  args: BaseArgs
): CorrectionRequestedEvent {
  return {
    eventId: createId("correction_event"),
    type: "CorrectionRequested",
    correctionId: args.correctionId ?? createId("correction"),
    createdAt: nowIso(),
    relatedValidationId: args.relatedValidationId,
    actor: args.actor,
    reason: args.reason
  };
}

export function createCorrectionDecision(
  request: CorrectionRequestedEvent,
  args: { actor: string; reason: string; approved: boolean }
): CorrectionApprovedEvent | CorrectionRejectedEvent {
  const base = {
    eventId: createId("correction_event"),
    correctionId: request.correctionId,
    createdAt: nowIso(),
    relatedValidationId: request.relatedValidationId,
    actor: args.actor,
    reason: args.reason
  };

  if (args.approved) {
    return {
      ...base,
      type: "CorrectionApproved",
      approved: true
    };
  }

  return {
    ...base,
    type: "CorrectionRejected",
    approved: false
  };
}

export function createCorrectionApplied(
  decision: CorrectionApprovedEvent,
  args: { actor: string; reason: string; replacementValidationId: string }
): CorrectionAppliedEvent {
  return {
    eventId: createId("correction_event"),
    type: "CorrectionApplied",
    correctionId: decision.correctionId,
    createdAt: nowIso(),
    relatedValidationId: decision.relatedValidationId,
    actor: args.actor,
    reason: args.reason,
    supersedesValidationId: decision.relatedValidationId,
    replacementValidationId: args.replacementValidationId
  };
}

export function createCorrectionSuperseded(
  prior: CorrectionAppliedEvent,
  args: { actor: string; reason: string; supersededByCorrectionId: string }
): CorrectionSupersededEvent {
  return {
    eventId: createId("correction_event"),
    type: "CorrectionSuperseded",
    correctionId: prior.correctionId,
    createdAt: nowIso(),
    relatedValidationId: prior.relatedValidationId,
    actor: args.actor,
    reason: args.reason,
    supersededByCorrectionId: args.supersededByCorrectionId
  };
}

export function isCorrectionSequenceValid(events: CorrectionEvent[]): boolean {
  if (events.length === 0) {
    return false;
  }
  const first = events[0];
  if (first.type !== "CorrectionRequested") {
    return false;
  }

  let approvedSeen = false;
  for (const event of events.slice(1)) {
    if (event.type === "CorrectionApproved") {
      approvedSeen = true;
    }
    if (event.type === "CorrectionApplied" && !approvedSeen) {
      return false;
    }
  }

  return true;
}
