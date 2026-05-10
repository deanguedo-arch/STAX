import type { OutputEnvelope, Provenance } from "../../types/index.js";
import { ingestRawObservation } from "../../ingest/index.js";
import { structureCandidate } from "../../structure/index.js";
import {
  eventHorizonFromProcessCandidateResult,
  processCandidate
} from "../../kernel/index.js";
import { generateSignalPacket, generateSignals } from "../../signal/index.js";
import { scoreConfidence } from "../../confidence/index.js";
import { frameOutput } from "../../frame/index.js";
import { attachContext } from "../../context/index.js";
import { createOutputEnvelope } from "../../exchange/index.js";

export function processObservation(
  content: string,
  provenance: Provenance,
  options: { allowRecommendations?: boolean } = {}
): OutputEnvelope<unknown> {
  const raw = ingestRawObservation(content, provenance);
  const candidate = structureCandidate(raw);
  const kernelResult = processCandidate(candidate);
  const horizon = eventHorizonFromProcessCandidateResult(candidate, kernelResult);
  const validation = horizon.validation;
  const signals = generateSignals([validation]);
  const confidence = scoreConfidence([validation], signals);
  const signalPacket = generateSignalPacket({
    events: [validation],
    signals,
    confidence,
    rejectionReasons: horizon.rejectionReasons,
    allowRecommendations: options.allowRecommendations
  });
  const framed = frameOutput({
    validation,
    signals,
    signalPacket,
    eventHorizon: horizon,
    kernelDecision: kernelResult.decision,
    kernelLedgerRecord: kernelResult.ledgerRecord
  });
  const contextualized = attachContext(framed);
  const uncertainty = {
    reasons: [
      ...horizon.uncertainty.uncertaintyReason,
      ...horizon.rejectionReasons.map((reason) => `event-horizon:${reason}`)
    ],
    missingData: horizon.uncertainty.missingData,
    confidenceCaps: [...horizon.uncertainty.confidenceCaps, ...confidence.caps],
    unresolvedConflicts:
      horizon.conflict?.sourceMap ?? horizon.uncertainty.unresolvedConflicts
  };

  return createOutputEnvelope({
    data: contextualized,
    confidence: confidence.score,
    warnings: validation.warnings,
    assumptions: [],
    conflicts: horizon.conflict?.sourceMap ?? [],
    uncertainty,
    inputId: raw.id,
    candidateIds: [candidate.id],
    validationIds: [validation.id],
    signalIds: signals.map((signal) => signal.id),
    ledgerRecordIds: [kernelResult.ledgerRecord.id],
    ledgerHashes: [kernelResult.ledgerRecord.hash]
  });
}
