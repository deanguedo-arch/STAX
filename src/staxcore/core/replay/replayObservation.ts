import type { OutputEnvelope, Provenance } from "../../types/index.js";
import { stableHash } from "../../shared/index.js";
import { processObservation } from "../api/processObservation.js";

export interface ReplayResult {
  deterministic: boolean;
  inputHash: string;
  outputHashes: string[];
}

export function stableOutputSignature(output: OutputEnvelope<unknown>): string {
  const payload = output.data as {
    data?: {
      data?: {
        validation?: {
          claim: string;
          state: string;
          warnings: string[];
        };
        signals?: Array<{
          type: string;
          description: string;
          provisional: boolean;
        }>;
        eventHorizon?: {
          rejectionReasons: string[];
          evidenceChainValid: boolean;
          conflict: {
            severity: string;
            sourceMap: string[];
            status: string;
          } | null;
        };
      };
    };
  };

  return stableHash({
    status: output.status,
    warnings: output.warnings,
    confidence: output.confidence,
    validation: payload.data?.data?.validation
      ? {
          claim: payload.data.data.validation.claim,
          state: payload.data.data.validation.state,
          warnings: payload.data.data.validation.warnings
        }
      : null,
    signals: payload.data?.data?.signals?.map((signal) => ({
      type: signal.type,
      description: signal.description,
      provisional: signal.provisional
    })),
    eventHorizon: payload.data?.data?.eventHorizon
      ? {
          rejectionReasons: payload.data.data.eventHorizon.rejectionReasons,
          evidenceChainValid:
            payload.data.data.eventHorizon.evidenceChainValid,
          conflict: payload.data.data.eventHorizon.conflict
            ? {
                severity: payload.data.data.eventHorizon.conflict.severity,
                sourceMap: payload.data.data.eventHorizon.conflict.sourceMap,
                status: payload.data.data.eventHorizon.conflict.status
              }
            : null
        }
      : null
  });
}

export function replayObservation(
  content: string,
  provenance: Provenance,
  iterations = 2
): ReplayResult {
  const inputHash = stableHash({ content, provenance });
  const outputHashes: string[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const output = processObservation(content, provenance);
    outputHashes.push(stableOutputSignature(output));
  }

  const deterministic = outputHashes.every((hash) => hash === outputHashes[0]);
  return { deterministic, inputHash, outputHashes };
}
