import type { OutputEnvelope, Provenance } from "../types/index.js";
import { processObservation } from "../core/api/processObservation.js";

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
  outputs: Array<{
    externalId?: string;
    output: OutputEnvelope<unknown>;
  }>;
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
  batch: StaxCoreAdapterBatch
): StaxCoreAdapterResult {
  assertAdapterBatch(batch);

  return {
    adapterId: batch.adapterId,
    adapterKind: batch.adapterKind,
    sourceRef: batch.sourceRef,
    outputs: batch.observations.map((observation) => ({
      externalId: observation.externalId,
      output: processObservation(observation.content, observation.provenance)
    }))
  };
}
