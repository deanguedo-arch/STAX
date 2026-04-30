import type { Provenance } from "../../src/staxcore/index.js";

export const measurementProvenance: Provenance = {
  sourceId: "source-1",
  sourceType: "measurement",
  occurredAt: "2026-04-28T16:00:00.000Z",
  receivedAt: "2026-04-29T00:00:00.000Z",
  capturedBy: "test",
  trustLevel: 0.9,
  rawReference: "test://source-1"
};
