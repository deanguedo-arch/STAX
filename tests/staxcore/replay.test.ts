import { describe, expect, it } from "vitest";
import { replayObservation } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore replay", () => {
  it("replays deterministic outputs for the same input and doctrine", () => {
    const result = replayObservation(
      "Measured observation entered the system.",
      measurementProvenance,
      3
    );

    expect(result.deterministic).toBe(true);
    expect(result.outputHashes).toHaveLength(3);
    expect(result.outputHashes[0]).toBe(result.outputHashes[1]);
    expect(result.outputHashes[1]).toBe(result.outputHashes[2]);
  });
});
