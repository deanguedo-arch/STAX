import type { EventCandidate, EventHorizonResult } from "../types/index.js";
import {
  eventHorizonFromProcessCandidateResult,
  processCandidate
} from "./processCandidate.js";
import type { KernelLedgerEvent, KernelLedgerWriter } from "./types.js";
import {
  readKernelTruth,
  sealKernelTruth,
  type KernelTruth,
  type KernelTruthView
} from "./truth.js";

export interface KernelEvaluation {
  truth: KernelTruth;
  eventHorizon: EventHorizonResult;
  ledgerRecordId: string;
  ledgerHash: string;
  ledgerValid: boolean;
}

export function evaluateCandidate(
  candidate: EventCandidate,
  ledger?: KernelLedgerWriter<KernelLedgerEvent>
): KernelEvaluation {
  const result = processCandidate(candidate, ledger);
  const truth = sealKernelTruth(result);
  const eventHorizon = eventHorizonFromProcessCandidateResult(candidate, result);

  return {
    truth,
    eventHorizon,
    ledgerRecordId: result.ledgerRecord.id,
    ledgerHash: result.ledgerRecord.hash,
    ledgerValid: result.ledgerValid
  };
}

export function readKernelEvaluationTruth(
  evaluation: KernelEvaluation
): KernelTruthView {
  return readKernelTruth(evaluation.truth);
}
