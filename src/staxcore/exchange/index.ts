import type { OutputEnvelope, WarningCode } from "../types/index.js";
import { buildAuditTrace } from "../shared/index.js";

export function createOutputEnvelope<T>(args: {
  data: T;
  confidence: number;
  warnings: WarningCode[];
  assumptions?: string[];
  conflicts?: string[];
  uncertainty: {
    reasons: string[];
    missingData: string[];
    confidenceCaps: string[];
    unresolvedConflicts: string[];
  };
  inputId: string;
  candidateIds: string[];
  validationIds: string[];
  signalIds: string[];
  ledgerRecordIds?: string[];
  ledgerHashes?: string[];
}): OutputEnvelope<T> {
  const hasHardUncertainty =
    args.uncertainty.missingData.length > 0 ||
    args.uncertainty.unresolvedConflicts.length > 0;

  return {
    status: hasHardUncertainty || args.warnings.length ? "warning" : "ok",
    data: args.data,
    warnings: args.warnings,
    assumptions: args.assumptions ?? [],
    conflicts: args.conflicts ?? args.uncertainty.unresolvedConflicts,
    uncertainty: args.uncertainty,
    confidence: args.confidence,
    auditTrace: buildAuditTrace({
      doctrineVersion: "core-v1",
      layerPath: [
        "ingest",
        "structure",
        "validate",
        "ledger",
        "signal",
        "confidence",
        "frame",
        "context",
        "exchange"
      ],
      inputId: args.inputId,
      candidateIds: args.candidateIds,
      validationIds: args.validationIds,
      signalIds: args.signalIds,
      ledgerRecordIds: args.ledgerRecordIds,
      ledgerHashes: args.ledgerHashes,
      warnings: args.warnings
    })
  };
}
