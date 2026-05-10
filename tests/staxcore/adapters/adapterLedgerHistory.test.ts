import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  KernelLedgerEvent,
  OutputEnvelope,
  StaxCoreAdapterBatch
} from "../../../src/staxcore/index.js";
import {
  KernelDurableLedger,
  processAdapterBatch,
  processAdapterBatchWithDurableLedger,
  replayLedger
} from "../../../src/staxcore/index.js";
import { measurementProvenance } from "../helpers.js";

const tempDirs: string[] = [];

function batch(observations: string[]): StaxCoreAdapterBatch {
  return {
    adapterId: "shared-ledger-adapter",
    adapterKind: "external_repo",
    sourceRef: "repo://example",
    observations: observations.map((content, index) => ({
      externalId: `obs-${index + 1}`,
      content,
      provenance: {
        ...measurementProvenance,
        rawReference: `test://adapter/${index + 1}`
      }
    }))
  };
}

function kernelLedgerRecord(output: OutputEnvelope<unknown>): {
  hash: string;
  previousHash: string | null;
} {
  return (output as {
    data: {
      data: {
        data: {
          kernelLedgerRecord: { hash: string; previousHash: string | null };
        };
      };
    };
  }).data.data.data.kernelLedgerRecord;
}

async function ledgerPath(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stax-adapter-ledger-"));
  tempDirs.push(root);
  return path.join(root, "kernel", "ledger.json");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("staxcore adapter shared ledger history", () => {
  it("processes a batch through one shared kernel ledger chain", () => {
    const result = processAdapterBatch(
      batch(["Measured event one.", "Measured event two."])
    );
    const first = kernelLedgerRecord(result.outputs[0].output);
    const second = kernelLedgerRecord(result.outputs[1].output);

    expect(result.outputs).toHaveLength(2);
    expect(result.ledgerHistory.recordCount).toBe(2);
    expect(result.ledgerHistory.valid).toBe(true);
    expect(result.ledgerHistory.ledgerHashes).toEqual([first.hash, second.hash]);
    expect(second.previousHash).toBe(first.hash);
    expect(result.ledgerHistory.rootHash).toBe(second.hash);
  });

  it("persists adapter batches across durable ledger load/save boundaries", async () => {
    const filePath = await ledgerPath();
    const emptyLedger = await KernelDurableLedger.load<KernelLedgerEvent>(filePath);
    const firstResult = await processAdapterBatchWithDurableLedger(
      batch(["Measured durable event one."]),
      emptyLedger
    );
    const reloaded = await KernelDurableLedger.load<KernelLedgerEvent>(filePath);
    const firstTip = reloaded.tipHash();
    const secondResult = await processAdapterBatchWithDurableLedger(
      batch(["Measured durable event two."]),
      reloaded
    );
    const finalLedger = await KernelDurableLedger.load<KernelLedgerEvent>(filePath);
    const finalReplay = replayLedger(finalLedger.all());

    expect(firstResult.ledgerHistory.recordCount).toBe(1);
    expect(secondResult.ledgerHistory.recordCount).toBe(2);
    expect(finalLedger.all()).toHaveLength(2);
    expect(finalLedger.all()[1].previousHash).toBe(firstTip);
    expect(secondResult.ledgerHistory.replaySignature).toBe(
      finalReplay.replaySignature
    );
    expect(finalReplay.valid).toBe(true);
  });
});
