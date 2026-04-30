import type { Provenance, RawObservation } from "../types/index.js";
import { assertSafeInput, createId, normalizeInput, nowIso } from "../shared/index.js";

export function ingestRawObservation(content: string, provenance: Provenance): RawObservation {
  assertSafeInput(content);
  if (!provenance.sourceId || !provenance.rawReference) {
    throw new Error("INVALID_INPUT: provenance required");
  }
  const normalized = normalizeInput(content);

  return {
    id: createId("raw"),
    content: normalized.normalizedContent,
    provenance,
    receivedAt: nowIso()
  };
}
