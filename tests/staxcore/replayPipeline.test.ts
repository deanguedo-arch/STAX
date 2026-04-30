import { describe, expect, it } from "vitest";
import { replayPipeline } from "../../src/staxcore/index.js";
import { measurementProvenance } from "./helpers.js";

describe("staxcore replay pipeline", () => {
  it("replays a multi-event chain deterministically with valid ledger hashes", () => {
    const result = replayPipeline([
      {
        content: "Measured event one.",
        provenance: measurementProvenance
      },
      {
        content: "Measured event two.",
        provenance: measurementProvenance
      }
    ]);

    expect(result.deterministic).toBe(true);
    expect(result.chainValid).toBe(true);
    expect(result.chainIssues).toEqual([]);
    expect(result.runOutputHashes).toHaveLength(2);
    expect(result.ledgerHashes).toHaveLength(2);
  });
});
