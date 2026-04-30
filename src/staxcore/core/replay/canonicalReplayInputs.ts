import type { ReplayPipelineInput } from "./replayPipeline.js";

export function canonicalReplayInputs(): ReplayPipelineInput[] {
  return [
    {
      content: "Measured flow was 120 GPM at 2026-04-28T10:00:00Z.",
      provenance: {
        sourceId: "measurement-flow-1",
        sourceType: "measurement",
        occurredAt: "2026-04-28T10:00:00Z",
        receivedAt: "2026-04-28T10:00:10Z",
        capturedBy: "staxcore_replay",
        trustLevel: 0.95,
        rawReference: "replay://measurement-flow-1"
      }
    },
    {
      content: "Inspector finding confirms no unresolved conflict.",
      provenance: {
        sourceId: "finding-2",
        sourceType: "finding",
        occurredAt: "2026-04-28T10:05:00Z",
        receivedAt: "2026-04-28T10:05:10Z",
        capturedBy: "staxcore_replay",
        trustLevel: 0.85,
        rawReference: "replay://finding-2"
      }
    }
  ];
}
