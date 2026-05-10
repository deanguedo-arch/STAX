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
        signalPacket?: {
          observations: Array<{
            state: string;
            claim: string;
            sourceType: string;
            warnings: string[];
          }>;
          patterns: Array<{
            description: string;
            provisional: boolean;
          }>;
          gaps: Array<{ description: string }>;
          risks: Array<{ description: string; severity: string }>;
          trends: Array<{
            description: string;
            direction: string;
            provisional: boolean;
          }>;
          recommendationPolicy: {
            allowed: boolean;
            withheld: boolean;
            reason: string;
          };
          confidence: {
            score: number;
            rationale: string;
            caps: string[];
          };
        };
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
    signalPacket: payload.data?.data?.signalPacket
      ? {
          observations: payload.data.data.signalPacket.observations.map(
            (observation) => ({
              state: observation.state,
              claim: observation.claim,
              sourceType: observation.sourceType,
              warnings: observation.warnings
            })
          ),
          patterns: payload.data.data.signalPacket.patterns.map((pattern) => ({
            description: pattern.description,
            provisional: pattern.provisional
          })),
          gaps: payload.data.data.signalPacket.gaps.map((gap) => ({
            description: gap.description
          })),
          risks: payload.data.data.signalPacket.risks.map((risk) => ({
            description: risk.description,
            severity: risk.severity
          })),
          trends: payload.data.data.signalPacket.trends.map((trend) => ({
            description: trend.description,
            direction: trend.direction,
            provisional: trend.provisional
          })),
          recommendationPolicy:
            payload.data.data.signalPacket.recommendationPolicy,
          confidence: payload.data.data.signalPacket.confidence
        }
      : null,
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
