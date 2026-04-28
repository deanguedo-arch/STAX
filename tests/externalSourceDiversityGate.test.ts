import { describe, expect, it } from "vitest";
import { ExternalSourceDiversityGate } from "../src/compare/ExternalSourceDiversityGate.js";

describe("ExternalSourceDiversityGate", () => {
  const gate = new ExternalSourceDiversityGate();

  it("rejects same source ID as duplicate source", () => {
    const result = gate.evaluate({
      sources: [
        { caseId: "a", sourceType: "chatgpt-thread", sourceId: "thread-1", captureContext: "p1", promptHash: "h1" },
        { caseId: "b", sourceType: "chatgpt-thread", sourceId: "thread-1", captureContext: "p2", promptHash: "h2" }
      ]
    });

    expect(result.status).toBe("single_source_slice");
    expect(result.duplicateSources).toContain("b");
  });

  it("counts same source new prompt as context only", () => {
    const result = gate.evaluate({
      minUniqueSources: 1,
      sources: [
        { caseId: "a", sourceType: "chatgpt-thread", sourceId: "thread-1", captureContext: "p1", promptHash: "h1" },
        { caseId: "b", sourceType: "chatgpt-thread", sourceId: "thread-1", captureContext: "p2", promptHash: "h2" }
      ]
    });

    expect(result.uniqueSourceCount).toBe(1);
    expect(result.uniqueContextCount).toBe(2);
  });

  it("counts different source types as diversity", () => {
    const result = gate.evaluate({
      sources: [
        { caseId: "a", sourceType: "chatgpt-thread", sourceId: "thread-1" },
        { caseId: "b", sourceType: "other-model", sourceId: "gemini-1" }
      ]
    });

    expect(result.status).toBe("source_diverse_eligible");
  });

  it("blocks missing metadata", () => {
    const result = gate.evaluate({ sources: [{ caseId: "a" }, { caseId: "b", sourceId: "thread-2" }] });

    expect(result.blockingReasons.join(" ")).toContain("missing sourceId");
  });
});
