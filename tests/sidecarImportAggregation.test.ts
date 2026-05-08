import { describe, expect, it } from "vitest";
import {
  aggregateSidecarImportCandidates,
  renderSidecarImportAggregation
} from "../src/learning/SidecarImportAggregation.js";
import type { SidecarImportCandidate } from "../src/learning/SidecarImportCandidate.js";

describe("sidecar import aggregation", () => {
  it("turns repeated single-event sidecar evidence into promotable aggregate patterns", () => {
    const aggregates = aggregateSidecarImportCandidates([
      candidate("handoff-1", "evt-1", "Codex handoff prompt should include repo path and exact commands."),
      candidate("handoff-2", "evt-2", "Codex handoff prompt should include files to inspect, schema validation notes, and stop condition."),
      candidate("proof-1", "evt-3", "wrong repo command output must not verify target repo."),
      candidate("proof-2", "evt-4", "Codex report lacks file list, diff, and command output."),
      candidate("fact-1", "evt-5", "package-lock.json changed after npm install."),
      candidate("fact-2", "evt-6", "package-lock.json changed once in brightspacequizexporter.")
    ]);

    const handoff = aggregates.find((aggregate) => aggregate.classification === "codex_handoff_rule");
    const proof = aggregates.find((aggregate) => aggregate.classification === "proof_boundary_rule");
    const repoFact = aggregates.find((aggregate) => aggregate.classification === "repo_specific_fact");

    expect(handoff).toMatchObject({
      candidateCount: 2,
      promotable: true,
      recommendedQueueType: "codex_prompt_candidate",
      promotionTarget: "mode_contract_patch",
      sourceCandidateIds: ["handoff-1", "handoff-2"]
    });
    expect(handoff?.requiredEvidence).toContain("repeatability evidence");
    expect(proof).toMatchObject({
      candidateCount: 2,
      promotable: true,
      recommendedQueueType: "eval_candidate",
      promotionTarget: "eval",
      sourceCandidateIds: ["proof-1", "proof-2"]
    });
    expect(repoFact).toMatchObject({
      candidateCount: 2,
      promotable: false,
      recommendedQueueType: "trace_only",
      promotionTarget: "none"
    });
  });

  it("renders a human review report without approving or promoting aggregates", () => {
    const aggregates = aggregateSidecarImportCandidates([
      candidate("schema-1", "evt-1", "schema validation weakness let malformed output silently pass."),
      candidate("schema-2", "evt-2", "schema contract patch needed for malformed validator output.")
    ]);

    const report = renderSidecarImportAggregation(aggregates);

    expect(report).toContain("Pending Aggregate Pattern Review");
    expect(report).toContain("Classification: schema_contract_rule");
    expect(report).toContain("Promotable: yes");
    expect(report).toContain("Requires human approval: yes");
    expect(report).not.toContain("approved");
  });
});

function candidate(candidateId: string, sourceEventId: string, summary: string): SidecarImportCandidate {
  return {
    candidateId,
    sourceEventId,
    sourceRepo: {
      name: "brightspacequizexporter",
      pathHash: "abcdef1234567890",
      branch: "main",
      commitSha: "abc123"
    },
    candidateType: "repo_memory",
    scope: "repo",
    summary,
    proposedArtifact: {
      destinationHint: "memory/candidates/",
      payload: {
        summary
      }
    },
    requiresHumanApproval: true,
    status: "pending",
    privacy: {
      redactionStatus: "clean",
      redactionNotes: []
    },
    createdAt: "2026-05-08T00:00:00.000Z"
  };
}
