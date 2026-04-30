import type { WarningCode } from "./core.js";

export interface AuditTrace {
  traceId: string;
  doctrineVersion: string;
  generatedAt: string;
  layerPath: string[];
  inputId: string;
  candidateIds: string[];
  validationIds: string[];
  signalIds: string[];
  warnings: WarningCode[];
}

export interface OutputEnvelope<T> {
  status: "ok" | "warning" | "rejected";
  data: T;
  warnings: WarningCode[];
  assumptions: string[];
  conflicts: string[];
  uncertainty: {
    reasons: string[];
    missingData: string[];
    confidenceCaps: string[];
    unresolvedConflicts: string[];
  };
  confidence: number;
  auditTrace: AuditTrace;
}
