import type { Provenance, RawObservation } from "../types/index.js";
import { assertSafeInput, normalizeInput, nowIso, stableHash } from "../shared/index.js";

export function ingestRawObservation(content: string, provenance: Provenance): RawObservation {
  assertSafeInput(content);
  if (!provenance.sourceId || !provenance.rawReference) {
    throw new Error("INVALID_INPUT: provenance required");
  }
  const normalized = normalizeInput(content);

  return {
    id: `raw_${stableHash({
      content: normalized.normalizedContent,
      provenance
    }).slice(0, 20)}`,
    content: normalized.normalizedContent,
    provenance,
    receivedAt: nowIso()
  };
}
