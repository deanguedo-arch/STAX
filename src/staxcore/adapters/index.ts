import type { OutputEnvelope, Provenance } from "../types/index.js";
import { processObservation } from "../core/api/processObservation.js";
import {
  KernelAppendOnlyLedger,
  KernelDurableLedger,
  replayLedger,
  type KernelLedgerEvent,
  type KernelLedgerWriter
} from "../kernel/index.js";

export interface StaxCoreAdapterObservation {
  content: string;
  provenance: Provenance;
  externalId?: string;
}

export interface StaxCoreAdapterBatch {
  adapterId: string;
  adapterKind: "external_repo" | "sidecar" | "manual" | "import";
  sourceRef: string;
  observations: StaxCoreAdapterObservation[];
}

export interface StaxCoreAdapter {
  adapterId: string;
  collect(): StaxCoreAdapterBatch | Promise<StaxCoreAdapterBatch>;
}

export interface StaxCoreAdapterResult {
  adapterId: string;
  adapterKind: StaxCoreAdapterBatch["adapterKind"];
  sourceRef: string;
  ledgerHistory: StaxCoreAdapterLedgerHistory;
  outputs: Array<{
    externalId?: string;
    ledgerRecordId?: string;
    ledgerHash?: string;
    output: OutputEnvelope<unknown>;
  }>;
}

export interface StaxCoreAdapterLedgerHistory {
  recordCount: number;
  rootHash: string | null;
  replaySignature: string;
  valid: boolean;
  issues: string[];
  ledgerRecordIds: string[];
  ledgerHashes: string[];
}

export interface ProcessAdapterBatchOptions {
  ledger?: KernelLedgerWriter<KernelLedgerEvent>;
  allowRecommendations?: boolean;
}

export function assertAdapterBatch(batch: StaxCoreAdapterBatch): void {
  if (!batch.adapterId.trim()) {
    throw new Error("ADAPTER_CONTRACT_VIOLATION: adapterId is required.");
  }
  if (!batch.sourceRef.trim()) {
    throw new Error("ADAPTER_CONTRACT_VIOLATION: sourceRef is required.");
  }
  if (batch.observations.length === 0) {
    throw new Error("ADAPTER_CONTRACT_VIOLATION: observations are required.");
  }

  for (const [index, observation] of batch.observations.entries()) {
    if (!observation.content.trim()) {
      throw new Error(
        `ADAPTER_CONTRACT_VIOLATION: observation ${index} content is required.`
      );
    }
    if (!observation.provenance.sourceId.trim()) {
      throw new Error(
        `ADAPTER_CONTRACT_VIOLATION: observation ${index} sourceId is required.`
      );
    }
    if (!observation.provenance.rawReference.trim()) {
      throw new Error(
        `ADAPTER_CONTRACT_VIOLATION: observation ${index} rawReference is required.`
      );
    }
  }
}

export function processAdapterBatch(
  batch: StaxCoreAdapterBatch,
  options: ProcessAdapterBatchOptions = {}
): StaxCoreAdapterResult {
  assertAdapterBatch(batch);
  const ledger =
    options.ledger ?? new KernelAppendOnlyLedger<KernelLedgerEvent>();
  const outputs = batch.observations.map((observation) => {
    const output = processObservation(observation.content, observation.provenance, {
      allowRecommendations: options.allowRecommendations,
      ledger
    });
    const ledgerRecordId = output.auditTrace.ledgerRecordIds.at(-1);
    const ledgerHash = output.auditTrace.ledgerHashes.at(-1);
    return {
      externalId: observation.externalId,
      ledgerRecordId,
      ledgerHash,
      output
    };
  });
  const records = ledger.all();
  const replay = replayLedger(records);

  return {
    adapterId: batch.adapterId,
    adapterKind: batch.adapterKind,
    sourceRef: batch.sourceRef,
    ledgerHistory: {
      recordCount: records.length,
      rootHash: replay.rootHash,
      replaySignature: replay.replaySignature,
      valid: replay.valid,
      issues: replay.issues,
      ledgerRecordIds: records.map((record) => record.id),
      ledgerHashes: records.map((record) => record.hash)
    },
    outputs
  };
}

function durableLedgerWriter(
  ledger: KernelDurableLedger<KernelLedgerEvent>
): KernelLedgerWriter<KernelLedgerEvent> {
  return {
    append(event, options) {
      return ledger.append(event, {
        ...options,
        expectedTipHash: ledger.tipHash()
      });
    },
    all() {
      return ledger.all();
    },
    verifyChain() {
      return ledger.verifyChain();
    }
  };
}

export async function processAdapterBatchWithDurableLedger(
  batch: StaxCoreAdapterBatch,
  ledger: KernelDurableLedger<KernelLedgerEvent>,
  options: Omit<ProcessAdapterBatchOptions, "ledger"> & { save?: boolean } = {}
): Promise<StaxCoreAdapterResult> {
  const result = processAdapterBatch(batch, {
    allowRecommendations: options.allowRecommendations,
    ledger: durableLedgerWriter(ledger)
  });
  if (options.save !== false) {
    await ledger.save();
  }
  return result;
}
