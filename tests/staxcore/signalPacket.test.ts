import { describe, expect, it } from "vitest";
import {
  generateSignalPacket,
  generateSignals,
  processObservation,
  scoreConfidence,
  validateEventHorizon
} from "../../src/staxcore/index.js";
import type { EventCandidate, SignalPacket, ValidatedEvent } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

function packetFrom(output: unknown): SignalPacket {
  return (output as {
    data: { data: { data: { signalPacket: SignalPacket } } };
  }).data.data.data.signalPacket;
}

function candidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    id: "candidate-signal-packet",
    rawId: "raw-signal-packet",
    claim: "Measured observation entered the system.",
    state: "CANDIDATE",
    provenance: measurementProvenance,
    uncertaintyReason: [],
    missingData: [],
    confidenceCaps: [],
    unresolvedConflicts: [],
    ...overrides
  };
}

describe("staxcore signal packet", () => {
  it("emits a neutral packet with observations, gaps, trends, policy, and confidence", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );
    const packet = packetFrom(output);

    expect(packet.observations).toHaveLength(1);
    expect(packet.observations[0]?.state).toBe("VALIDATED");
    expect(packet.patterns[0]?.description).toContain("Insufficient validated event count");
    expect(packet.trends[0]?.direction).toBe("unknown");
    expect(packet.recommendationPolicy).toEqual({
      allowed: false,
      withheld: true,
      reason: "Recommendations are withheld by default; STAX Core emits evidence signals only."
    });
    expect(packet.confidence.score).toBe(output.confidence);
  });

  it("surfaces missing data as gaps instead of silently treating it as truth", () => {
    const horizon = validateEventHorizon(
      candidate({
        missingData: ["occurredAt", "source-baseline"],
        confidenceCaps: ["missing-occurredAt-cap"]
      })
    );
    const events = [horizon.validation];
    const signals = generateSignals(events);
    const confidence = scoreConfidence(events, signals);
    const packet = generateSignalPacket({
      events,
      signals,
      confidence,
      rejectionReasons: horizon.rejectionReasons
    });

    expect(packet.gaps.map((gap) => gap.description)).toEqual(
      expect.arrayContaining([
        "Missing data: occurredAt",
        "Missing data: source-baseline"
      ])
    );
    expect(packet.confidence.caps).toContain("missing-critical-data-cap");
  });

  it("does not derive patterns or trends from rejected recommendation events", () => {
    const output = processObservation("You should change this immediately.", {
      ...measurementProvenance,
      sourceType: "recommendation"
    });
    const packet = packetFrom(output);

    expect(packet.observations[0]?.state).toBe("REJECTED");
    expect(packet.patterns).toEqual([]);
    expect(packet.trends).toEqual([]);
    expect(packet.risks.map((risk) => risk.description)).toContain(
      "Recommendation source is quarantined from truth issuance."
    );
    expect(packet.confidence.score).toBeLessThan(0.5);
  });

  it("keeps recommendation output withheld unless caller policy explicitly allows it", () => {
    const withheld = packetFrom(
      processObservation("Measured observation entered the system.", measurementProvenance)
    );
    const allowed = packetFrom(
      processObservation("Measured observation entered the system.", measurementProvenance, {
        allowRecommendations: true
      })
    );

    expect(withheld.recommendationPolicy.withheld).toBe(true);
    expect(allowed.recommendationPolicy.allowed).toBe(true);
    expect(allowed.recommendationPolicy.withheld).toBe(false);
  });

  it("derives multi-event patterns only from trusted validation states", () => {
    const validated: ValidatedEvent = {
      id: "validation-valid",
      candidateId: "candidate-valid",
      claim: "Measured event.",
      state: "VALIDATED",
      sourceId: "source-1",
      sourceType: "measurement",
      evidenceChainValid: true,
      missingData: [],
      confidenceCaps: [],
      warnings: []
    };
    const rejected: ValidatedEvent = {
      ...validated,
      id: "validation-rejected",
      candidateId: "candidate-rejected",
      claim: "Recommendation event.",
      state: "REJECTED",
      sourceType: "recommendation",
      warnings: ["RECOMMENDATION_DETECTED"]
    };
    const events = [validated, rejected];
    const signals = generateSignals(events);
    const confidence = scoreConfidence(events, signals);
    const packet = generateSignalPacket({ events, signals, confidence });

    expect(packet.patterns.flatMap((pattern) => pattern.sourceValidationIds)).toEqual([
      "validation-valid"
    ]);
    expect(packet.patterns.flatMap((pattern) => pattern.sourceValidationIds)).not.toContain(
      "validation-rejected"
    );
  });
});
