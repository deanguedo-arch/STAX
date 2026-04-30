import { describe, expect, it } from "vitest";
import {
  inspectInput,
  normalizeInput,
  processObservation
} from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore security normalization", () => {
  it("normalizes control chars and flags unsafe content", () => {
    const normalized = normalizeInput("safe\u0000text\u0007");
    expect(normalized.normalizedContent).toBe("safetext");
    expect(normalized.controlCharsRemoved).toBeGreaterThan(0);

    const warnings = inspectInput("safe\u0000text\u0007");
    expect(warnings).toContain("UNSAFE_INPUT");
  });

  it("caps oversized input and rejects it", () => {
    const oversized = "x".repeat(10050);
    const normalized = normalizeInput(oversized);
    expect(normalized.wasTruncated).toBe(true);
    expect(normalized.normalizedContent.length).toBe(10000);

    expect(() => processObservation(oversized, measurementProvenance)).toThrow(
      /SECURITY_REJECTION/
    );
  });
});
