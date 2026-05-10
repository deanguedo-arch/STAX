import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { processObservation } from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

function framedPayload(output: unknown): {
  kernelLedgerRecord: { id: string; hash: string };
  validation: { state: string };
  signalPacket: {
    recommendationPolicy: { withheld: boolean };
    patterns: unknown[];
    trends: unknown[];
  };
} {
  return (output as {
    data: {
      data: {
        data: {
          kernelLedgerRecord: { id: string; hash: string };
          validation: { state: string };
          signalPacket: {
            recommendationPolicy: { withheld: boolean };
            patterns: unknown[];
            trends: unknown[];
          };
        };
      };
    };
  }).data.data.data;
}

describe("processObservation kernel path", () => {
  it("routes the main STAX output path through the public kernel API, not validateEventHorizon", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "staxcore", "core", "api", "processObservation.ts"),
      "utf8"
    );

    expect(source).toContain("evaluateCandidate");
    expect(source).toContain("readKernelEvaluationTruth");
    expect(source).toContain("generateSignals([kernelEvaluation.truth])");
    expect(source).toContain("truths: [kernelEvaluation.truth]");
    expect(source).not.toContain("validateEventHorizon");
    expect(source).not.toContain("generateSignals([validation])");
  });

  it("emits kernel ledger authority in the output and audit trace", () => {
    const output = processObservation(
      "Measured observation entered the system.",
      measurementProvenance
    );
    const payload = framedPayload(output);

    expect(payload.validation.state).toBe("VALIDATED");
    expect(payload.kernelLedgerRecord.id).toMatch(/^kernel_ledger_/);
    expect(payload.kernelLedgerRecord.hash).toHaveLength(64);
    expect(output.auditTrace.layerPath).toContain("ledger");
    expect(output.auditTrace.ledgerRecordIds).toEqual([
      payload.kernelLedgerRecord.id
    ]);
    expect(output.auditTrace.ledgerHashes).toEqual([
      payload.kernelLedgerRecord.hash
    ]);
  });

  it("keeps recommendation input rejected and withheld through the kernel path", () => {
    const output = processObservation("You should change this immediately.", {
      ...measurementProvenance,
      sourceType: "recommendation"
    });
    const payload = framedPayload(output);

    expect(payload.validation.state).toBe("REJECTED");
    expect(payload.signalPacket.patterns).toEqual([]);
    expect(payload.signalPacket.trends).toEqual([]);
    expect(payload.signalPacket.recommendationPolicy.withheld).toBe(true);
  });
});
