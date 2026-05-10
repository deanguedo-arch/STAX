import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAdapterBatch,
  processAdapterBatch,
  type StaxCoreAdapterBatch
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function batch(
  overrides: Partial<StaxCoreAdapterBatch> = {}
): StaxCoreAdapterBatch {
  return {
    adapterId: "generic-sidecar-adapter",
    adapterKind: "external_repo",
    sourceRef: "repo://example",
    observations: [
      {
        externalId: "obs-1",
        content: "Measured observation entered the system.",
        provenance: measurementProvenance
      }
    ],
    ...overrides
  };
}

describe("generic STAX Core adapter contract", () => {
  it("processes adapter observations without domain-specific assumptions", () => {
    const result = processAdapterBatch(batch());

    expect(result.adapterId).toBe("generic-sidecar-adapter");
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].externalId).toBe("obs-1");
    expect(result.outputs[0].output.auditTrace.ledgerHashes).toHaveLength(1);
    expect(result.outputs[0].ledgerHash).toBe(
      result.outputs[0].output.auditTrace.ledgerHashes[0]
    );
    expect(result.ledgerHistory.recordCount).toBe(1);
    expect(result.ledgerHistory.valid).toBe(true);
  });

  it("fails loud when required adapter evidence is missing", () => {
    expect(() =>
      assertAdapterBatch(
        batch({
          observations: [
            {
              content: "Missing source id.",
              provenance: {
                ...measurementProvenance,
                sourceId: ""
              }
            }
          ]
        })
      )
    ).toThrow(/sourceId is required/);
  });

  it("does not name a domain into the adapter contract", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "staxcore", "adapters", "index.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/DWG|aftermarket|checkout|quote|pricing|WhatsApp/i);
  });
});
