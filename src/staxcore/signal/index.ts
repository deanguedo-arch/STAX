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
import { readKernelTruth, type KernelTruth } from "../kernel/index.js";
import { stableHash } from "../shared/index.js";

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}_${stableHash(value).slice(0, 20)}`;
}

function eventsFromKernelTruth(
  truths: readonly KernelTruth[]
): ValidatedEvent[] {
  return truths.map((truth) => readKernelTruth(truth).validation);
}

function buildSignals(events: readonly ValidatedEvent[]): Signal[] {
  return events.map((event) => {
    const type = event.state === "VALIDATED" ? "recurrence" : "conflict";
    const description =
      event.state === "VALIDATED"
        ? `Validated event available: ${event.claim}`
        : `Rejected/conflicted event: ${event.claim}`;
    const provisional = event.state !== "VALIDATED";
    return {
      id: deterministicId("signal", {
        type,
        description,
        sourceValidationIds: [event.id],
        provisional
      }),
      type,
      description,
      sourceValidationIds: [event.id],
      provisional
    };
  });
}

export function generateSignals(truths: readonly KernelTruth[]): Signal[] {
  return buildSignals(eventsFromKernelTruth(truths));
}

export function generateSignalPacket(input: {
  truths: readonly KernelTruth[];
  confidence: ConfidenceResult;
  rejectionReasons?: CandidateRejectionReason[];
  allowRecommendations?: boolean;
}): SignalPacket {
  const events = eventsFromKernelTruth(input.truths);
  const signals = buildSignals(events);
  const trustedEvents = events.filter((event) =>
    event.state === "VALIDATED" || event.state === "CONFLICTED"
  );
  const rejectedEvents = events.filter((event) => event.state === "REJECTED");
  const gaps = buildGaps(events, input.rejectionReasons ?? []);
  const risks = buildRisks(events, input.rejectionReasons ?? []);
  const patterns = buildPatterns(trustedEvents, signals);
  const trends = buildTrends(trustedEvents);
  const allowRecommendations = input.allowRecommendations === true;

  return {
    observations: events.map((event) => ({
      validationId: event.id,
      state: event.state as "VALIDATED" | "CONFLICTED" | "REJECTED" | "SUPERSEDED",
      claim: event.claim,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      warnings: event.warnings
    })),
    patterns: rejectedEvents.length === events.length ? [] : patterns,
    gaps,
    risks,
    trends: rejectedEvents.length === events.length ? [] : trends,
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
        id: deterministicId("pattern", {
          kind: "insufficient-validated-count",
          sourceValidationIds: events.map((event) => event.id)
        }),
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
    .map((signal, index) => ({
      id: deterministicId("pattern", {
        index,
        description: signal.description,
        sourceValidationIds: signal.sourceValidationIds,
        provisional: signal.provisional
      }),
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
    for (const [index, missing] of event.missingData.entries()) {
      gaps.push({
        id: deterministicId("gap", {
          kind: "missing-data",
          index,
          missing,
          sourceValidationIds: [event.id]
        }),
        description: `Missing data: ${missing}`,
        sourceValidationIds: [event.id]
      });
    }
    if (!event.evidenceChainValid) {
      gaps.push({
        id: deterministicId("gap", {
          kind: "incomplete-evidence-chain",
          sourceValidationIds: [event.id]
        }),
        description: "Evidence chain is incomplete.",
        sourceValidationIds: [event.id]
      });
    }
  }
  if (rejectionReasons.includes("insufficientEvidence") && gaps.length === 0) {
    gaps.push({
      id: deterministicId("gap", {
        kind: "insufficient-evidence",
        sourceValidationIds: events.map((event) => event.id)
      }),
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
        id: deterministicId("risk", {
          kind: "recommendation-quarantine",
          sourceValidationIds: [event.id]
        }),
        description: "Recommendation source is quarantined from truth issuance.",
        sourceValidationIds: [event.id],
        severity: "high"
      });
    }
    if (event.warnings.includes("OPINION_DETECTED")) {
      risks.push({
        id: deterministicId("risk", {
          kind: "opinion-quarantine",
          sourceValidationIds: [event.id]
        }),
        description: "Opinion source is quarantined from truth issuance.",
        sourceValidationIds: [event.id],
        severity: "high"
      });
    }
    if (event.warnings.includes("CONFLICT_DETECTED")) {
      risks.push({
        id: deterministicId("risk", {
          kind: "conflict-resolution-required",
          sourceValidationIds: [event.id]
        }),
        description: "Conflicting evidence requires explicit resolution.",
        sourceValidationIds: [event.id],
        severity: "medium"
      });
    }
    if (event.warnings.includes("PROMPT_INJECTION_DETECTED")) {
      risks.push({
        id: deterministicId("risk", {
          kind: "prompt-injection-untrusted",
          sourceValidationIds: [event.id]
        }),
        description: "Prompt injection text was treated as untrusted input.",
        sourceValidationIds: [event.id],
        severity: "high"
      });
    }
  }
  if (rejectionReasons.includes("invalidSource")) {
    risks.push({
      id: deterministicId("risk", {
        kind: "invalid-provenance",
        sourceValidationIds: events.map((event) => event.id)
      }),
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
            id: deterministicId("trend", {
              kind: "insufficient-trend-count",
              sourceValidationIds: events.map((event) => event.id)
            }),
            description: "Trend unavailable until multiple validated events exist.",
            sourceValidationIds: events.map((event) => event.id),
            direction: "unknown",
            provisional: true
          }
        ];
  }

  return [
    {
      id: deterministicId("trend", {
        kind: "multiple-trusted-events",
        sourceValidationIds: events.map((event) => event.id)
      }),
      description: "Multiple trusted events are available for trend analysis.",
      sourceValidationIds: events.map((event) => event.id),
      direction: "unknown",
      provisional: true
    }
  ];
}
