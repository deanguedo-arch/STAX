import { describe, expect, it } from "vitest";
import type { OutputEnvelope } from "../../../src/staxcore/index.js";
import {
  processObservation,
  stableOutputSignature
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function cloneOutput(output: OutputEnvelope<unknown>): OutputEnvelope<unknown> {
  return JSON.parse(JSON.stringify(output)) as OutputEnvelope<unknown>;
}

function framedPayload(output: OutputEnvelope<unknown>): {
  kernelLedgerRecord: { id: string; hash: string };
} {
  return (output as {
    data: {
      data: {
        data: {
          kernelLedgerRecord: { id: string; hash: string };
        };
      };
    };
  }).data.data.data;
}

describe("audit trace ledger authority", () => {
  it("places ledger authority between validation and signal in the trace", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );
    const layerPath = output.auditTrace.layerPath;

    expect(layerPath.indexOf("ledger")).toBeGreaterThan(
      layerPath.indexOf("validate")
    );
    expect(layerPath.indexOf("ledger")).toBeLessThan(layerPath.indexOf("signal"));
  });

  it("copies the kernel ledger record into audit references", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );
    const payload = framedPayload(output);

    expect(output.auditTrace.ledgerRecordIds).toEqual([
      payload.kernelLedgerRecord.id
    ]);
    expect(output.auditTrace.ledgerHashes).toEqual([
      payload.kernelLedgerRecord.hash
    ]);
  });

  it("keeps replay signatures stable across volatile audit metadata", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );
    const changed = cloneOutput(output);
    changed.auditTrace.traceId = "trace_other";
    changed.auditTrace.generatedAt = "2099-01-01T00:00:00.000Z";

    expect(stableOutputSignature(changed)).toBe(stableOutputSignature(output));
  });

  it("changes replay signatures when ledger authority changes", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );
    const changed = cloneOutput(output);
    changed.auditTrace.ledgerHashes = ["0".repeat(64)];

    expect(stableOutputSignature(changed)).not.toBe(
      stableOutputSignature(output)
    );
  });
});
