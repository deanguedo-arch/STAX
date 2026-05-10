import type {
  CandidateRejectionReason,
  ConfidenceResult,
  Signal,
  SignalGap,
  SignalPacket,
  SignalPattern,
  SignalRisk,
  SignalTrend,
  ValidatedEvent
} from "../types/index.js";
import { createId } from "../shared/index.js";

export function generateSignals(events: ValidatedEvent[]): Signal[] {
  return events.map((event) => ({
    id: createId("signal"),
    type: event.state === "VALIDATED" ? "recurrence" : "conflict",
    description:
      event.state === "VALIDATED"
        ? `Validated event available: ${event.claim}`
        : `Rejected/conflicted event: ${event.claim}`,
    sourceValidationIds: [event.id],
    provisional: event.state !== "VALIDATED"
  }));
}

export function generateSignalPacket(input: {
  events: ValidatedEvent[];
  signals: Signal[];
  confidence: ConfidenceResult;
  rejectionReasons?: CandidateRejectionReason[];
  allowRecommendations?: boolean;
}): SignalPacket {
  const trustedEvents = input.events.filter((event) =>
    event.state === "VALIDATED" || event.state === "CONFLICTED"
  );
  const rejectedEvents = input.events.filter((event) => event.state === "REJECTED");
  const gaps = buildGaps(input.events, input.rejectionReasons ?? []);
  const risks = buildRisks(input.events, input.rejectionReasons ?? []);
  const patterns = buildPatterns(trustedEvents, input.signals);
  const trends = buildTrends(trustedEvents);
  const allowRecommendations = input.allowRecommendations === true;

  return {
    observations: input.events.map((event) => ({
      validationId: event.id,
      state: event.state as "VALIDATED" | "CONFLICTED" | "REJECTED" | "SUPERSEDED",
      claim: event.claim,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      warnings: event.warnings
    })),
    patterns: rejectedEvents.length === input.events.length ? [] : patterns,
    gaps,
    risks,
    trends: rejectedEvents.length === input.events.length ? [] : trends,
    recommendationPolicy: {
      allowed: allowRecommendations,
      withheld: !allowRecommendations,
      reason: allowRecommendations
        ? "Recommendation output explicitly allowed by caller policy."
        : "Recommendations are withheld by default; STAX Core emits evidence signals only."
    },
    confidence: {
      score: input.confidence.score,
      rationale: input.confidence.explanation,
      caps: input.confidence.caps
    }
  };
}

function buildPatterns(events: ValidatedEvent[], signals: Signal[]): SignalPattern[] {
  if (events.length === 0) return [];
  if (events.length < 2) {
    return [
      {
        id: createId("pattern"),
        description: "Insufficient validated event count for a durable pattern.",
        sourceValidationIds: events.map((event) => event.id),
        provisional: true
      }
    ];
  }

  return signals
    .filter((signal) =>
      signal.sourceValidationIds.some((id) =>
        events.some((event) => event.id === id)
      )
    )
    .map((signal) => ({
      id: createId("pattern"),
      description: signal.description,
      sourceValidationIds: signal.sourceValidationIds,
      provisional: signal.provisional
    }));
}

function buildGaps(
  events: ValidatedEvent[],
  rejectionReasons: CandidateRejectionReason[]
): SignalGap[] {
  const gaps: SignalGap[] = [];
  for (const event of events) {
    for (const missing of event.missingData) {
      gaps.push({
        id: createId("gap"),
        description: `Missing data: ${missing}`,
        sourceValidationIds: [event.id]
      });
    }
    if (!event.evidenceChainValid) {
      gaps.push({
        id: createId("gap"),
        description: "Evidence chain is incomplete.",
        sourceValidationIds: [event.id]
      });
    }
  }
  if (rejectionReasons.includes("insufficientEvidence") && gaps.length === 0) {
    gaps.push({
      id: createId("gap"),
      description: "Insufficient evidence for full validation.",
      sourceValidationIds: events.map((event) => event.id)
    });
  }
  return gaps;
}

function buildRisks(
  events: ValidatedEvent[],
  rejectionReasons: CandidateRejectionReason[]
): SignalRisk[] {
  const risks: SignalRisk[] = [];
  for (const event of events) {
    if (event.warnings.includes("RECOMMENDATION_DETECTED")) {
      risks.push({
        id: createId("risk"),
        description: "Recommendation source is quarantined from truth issuance.",
        sourceValidationIds: [event.id],
        severity: "high"
      });
    }
    if (event.warnings.includes("OPINION_DETECTED")) {
      risks.push({
        id: createId("risk"),
        description: "Opinion source is quarantined from truth issuance.",
        sourceValidationIds: [event.id],
        severity: "high"
      });
    }
    if (event.warnings.includes("CONFLICT_DETECTED")) {
      risks.push({
        id: createId("risk"),
        description: "Conflicting evidence requires explicit resolution.",
        sourceValidationIds: [event.id],
        severity: "medium"
      });
    }
    if (event.warnings.includes("PROMPT_INJECTION_DETECTED")) {
      risks.push({
        id: createId("risk"),
        description: "Prompt injection text was treated as untrusted input.",
        sourceValidationIds: [event.id],
        severity: "high"
      });
    }
  }
  if (rejectionReasons.includes("invalidSource")) {
    risks.push({
      id: createId("risk"),
      description: "Invalid or missing provenance prevents trusted truth issuance.",
      sourceValidationIds: events.map((event) => event.id),
      severity: "high"
    });
  }
  return risks;
}

function buildTrends(events: ValidatedEvent[]): SignalTrend[] {
  if (events.length < 2) {
    return events.length === 0
      ? []
      : [
          {
            id: createId("trend"),
            description: "Trend unavailable until multiple validated events exist.",
            sourceValidationIds: events.map((event) => event.id),
            direction: "unknown",
            provisional: true
          }
        ];
  }

  return [
    {
      id: createId("trend"),
      description: "Multiple trusted events are available for trend analysis.",
      sourceValidationIds: events.map((event) => event.id),
      direction: "unknown",
      provisional: true
    }
  ];
}
