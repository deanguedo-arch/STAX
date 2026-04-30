import type { EventCandidate, RawObservation } from "../types/index.js";
import { createId } from "../shared/index.js";

export function structureCandidate(raw: RawObservation): EventCandidate {
  const uncertaintyReason: string[] = [];
  const confidenceCaps: string[] = [];
  const missingData: string[] = [];
  const unresolvedConflicts: string[] = [];

  if (raw.provenance.trustLevel < 0.5) {
    uncertaintyReason.push("low source trust");
    confidenceCaps.push("low-trust-source-cap");
  }
  if (raw.provenance.sourceType === "opinion") {
    uncertaintyReason.push("opinion source requires quarantine");
  }
  if (raw.provenance.sourceType === "recommendation") {
    uncertaintyReason.push("recommendation source requires quarantine");
  }
  if (!raw.provenance.occurredAt) {
    missingData.push("occurredAt");
    confidenceCaps.push("missing-occurredAt-cap");
  }

  return {
    id: createId("candidate"),
    rawId: raw.id,
    claim: raw.content,
    state: "CANDIDATE",
    provenance: raw.provenance,
    uncertaintyReason,
    missingData,
    confidenceCaps,
    unresolvedConflicts
  };
}
