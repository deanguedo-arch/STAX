import { describe, expect, it } from "vitest";
import { ModeDetector } from "../src/classifiers/ModeDetector.js";

describe("ModeDetector", () => {
  it("detects planning mode with confidence and matched terms", () => {
    const result = new ModeDetector().detect("Build a project architecture plan.");

    expect(result.mode).toBe("planning");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.matchedTerms).toContain("build");
    expect(result.fallbackUsed).toBe(false);
  });

  it("falls back to analysis when confidence is low", () => {
    const result = new ModeDetector().detect("hello there");

    expect(result.mode).toBe("analysis");
    expect(result.fallbackUsed).toBe(true);
  });

  it("detects STAX fitness terms", () => {
    const result = new ModeDetector().detect("STAX fitness sleep recovery signal");

    expect(result.mode).toBe("stax_fitness");
    expect(result.matchedTerms).toEqual(
      expect.arrayContaining(["stax", "fitness", "sleep"])
    );
  });
});
