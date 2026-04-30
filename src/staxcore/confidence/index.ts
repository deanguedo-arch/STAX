import type {
  ConfidenceResult,
  ConfidenceVector,
  Signal,
  SourceType,
  ValidatedEvent
} from "../types/index.js";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const SOURCE_WEIGHTS: Record<SourceType, number> = {
  measurement: 1,
  finding: 0.9,
  decision: 0.8,
  narrative: 0.6,
  recommendation: 0.35,
  opinion: 0.25,
  ai_extraction: 0.5,
  unknown: 0.3
};

function averageSourceWeight(events: ValidatedEvent[]): number {
  if (events.length === 0) {
    return 0;
  }
  const total = events.reduce(
    (sum, event) => sum + (SOURCE_WEIGHTS[event.sourceType] ?? 0.3),
    0
  );
  return total / events.length;
}

export function scoreConfidence(
  events: ValidatedEvent[],
  signals: Signal[]
): ConfidenceResult {
  const validRatio =
    events.length === 0
      ? 0
      : events.filter((event) => event.state === "VALIDATED").length /
        events.length;
  const warningCount = events.reduce(
    (sum, event) => sum + event.warnings.length,
    0
  );
  const provisionalCount = signals.filter((signal) => signal.provisional).length;
  const sourceWeight = averageSourceWeight(events);
  const caps: string[] = [];

  if (events.length < 2) {
    caps.push("single-source-limit");
  }
  if (events.some((event) => event.missingData.length > 0)) {
    caps.push("missing-critical-data-cap");
  }
  if (events.some((event) => event.state === "CONFLICTED")) {
    caps.push("conflicting-evidence-cap");
  }
  if (events.every((event) => event.sourceType === "ai_extraction")) {
    caps.push("ai-only-extraction-cap");
  }
  if (warningCount > 0) {
    caps.push("warning-cap");
  }
  if (provisionalCount > 0) {
    caps.push("provisional-signal-cap");
  }
  if (sourceWeight < 0.5) {
    caps.push("low-source-strength-cap");
  }

  const vector: ConfidenceVector = {
    completeness: clamp(events.length / 3),
    consistency: clamp(validRatio),
    sourceStrength: clamp(sourceWeight - warningCount * 0.05),
    evidenceDensity: clamp(events.length / 5),
    conflictPenalty: clamp(warningCount * 0.1),
    recency: 1,
    traceability: clamp(
      events.filter((event) => event.evidenceChainValid).length /
        Math.max(events.length, 1)
    )
  };

  let score =
    (vector.completeness +
      vector.consistency +
      vector.sourceStrength +
      vector.evidenceDensity +
      vector.recency +
      vector.traceability) /
      6 -
    vector.conflictPenalty;

  if (caps.includes("single-source-limit")) {
    score = Math.min(score, 0.7);
  }
  if (caps.includes("missing-critical-data-cap")) {
    score = Math.min(score, 0.6);
  }
  if (caps.includes("conflicting-evidence-cap")) {
    score = Math.min(score, 0.55);
  }
  if (caps.includes("ai-only-extraction-cap")) {
    score = Math.min(score, 0.5);
  }
  if (caps.includes("warning-cap")) {
    score = Math.min(score, 0.65);
  }
  if (caps.includes("low-source-strength-cap")) {
    score = Math.min(score, 0.55);
  }

  return {
    score: clamp(score),
    vector,
    caps,
    sourceWeight,
    explanation: caps.length
      ? `Confidence capped by evidence quality constraints: ${caps.join(", ")}`
      : "Confidence based on evidence quality only."
  };
}
