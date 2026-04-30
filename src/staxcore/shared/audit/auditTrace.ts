import type { AuditTrace, WarningCode } from "../../types/index.js";
import { createId } from "../id.js";
import { nowIso } from "../time.js";

export function buildAuditTrace(args: {
  doctrineVersion: string;
  layerPath: string[];
  inputId: string;
  candidateIds?: string[];
  validationIds?: string[];
  signalIds?: string[];
  warnings?: WarningCode[];
}): AuditTrace {
  return {
    traceId: createId("trace"),
    doctrineVersion: args.doctrineVersion,
    generatedAt: nowIso(),
    layerPath: args.layerPath,
    inputId: args.inputId,
    candidateIds: args.candidateIds ?? [],
    validationIds: args.validationIds ?? [],
    signalIds: args.signalIds ?? [],
    warnings: args.warnings ?? []
  };
}
