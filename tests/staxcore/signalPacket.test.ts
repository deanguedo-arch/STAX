import { describe, expect, it } from "vitest";
import {
  evaluateCandidate,
  generateSignalPacket,
  generateSignals,
  processObservation,
  readKernelEvaluationTruth,
  scoreConfidence
} from "../../src/staxcore/index.js";
import type {
  EventCandidate,
  KernelTruth,
  SignalPacket
} from "../../src/staxcore/index.js";
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
    const evaluation = evaluateCandidate(
      candidate({
        missingData: ["occurredAt", "source-baseline"],
        confidenceCaps: ["missing-occurredAt-cap"]
      })
    );
    const horizon = evaluation.eventHorizon;
    const events = [readKernelEvaluationTruth(evaluation).validation];
    const truths = [evaluation.truth];
    const signals = generateSignals(truths);
    const confidence = scoreConfidence(events, signals);
    const packet = generateSignalPacket({
      truths,
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

  it("rejects unsealed truth-shaped objects at the signal boundary", () => {
    const evaluation = evaluateCandidate(candidate());
    const forgedTruth = readKernelEvaluationTruth(evaluation) as unknown as KernelTruth;

    expect(() => generateSignals([forgedTruth])).toThrow(/not sealed kernel truth/);
    expect(() =>
      generateSignalPacket({
        truths: [forgedTruth],
        confidence: scoreConfidence(
          [readKernelEvaluationTruth(evaluation).validation],
          []
        )
      })
    ).toThrow(/not sealed kernel truth/);
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
    const validated = evaluateCandidate(
      candidate({
        id: "candidate-valid",
        rawId: "raw-candidate-valid",
        claim: "Measured event."
      })
    );
    const rejected = evaluateCandidate(
      candidate({
        id: "candidate-rejected",
        rawId: "raw-candidate-rejected",
        claim: "Recommendation event.",
        provenance: {
          ...measurementProvenance,
          sourceType: "recommendation"
        }
      })
    );
    const events = [
      readKernelEvaluationTruth(validated).validation,
      readKernelEvaluationTruth(rejected).validation
    ];
    const truths = [validated.truth, rejected.truth];
    const signals = generateSignals(truths);
    const confidence = scoreConfidence(events, signals);
    const packet = generateSignalPacket({ truths, confidence });
    const trustedValidationId = events[0].id;

    expect(packet.patterns.flatMap((pattern) => pattern.sourceValidationIds)).toEqual([
      trustedValidationId
    ]);
    expect(packet.patterns.flatMap((pattern) => pattern.sourceValidationIds)).not.toContain(
      events[1].id
    );
  });
});
