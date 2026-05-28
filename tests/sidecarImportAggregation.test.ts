import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateSidecarImportCandidates,
  renderSidecarImportAggregation
} from "../src/learning/SidecarImportAggregation.js";
import type { SidecarImportCandidate } from "../src/learning/SidecarImportCandidate.js";
import { buildSidecarLearningDashboard } from "../src/learning/SidecarLearningDashboard.js";

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
      recommendedAction: "review_for_promotion",
      promotable: true,
      recommendedQueueType: "codex_prompt_candidate",
      promotionTarget: "mode_contract_patch",
      sourceCandidateIds: ["handoff-1", "handoff-2"]
    });
    expect(handoff?.requiredEvidence).toContain("repeatability evidence");
    expect(proof).toMatchObject({
      candidateCount: 2,
      recommendedAction: "review_for_promotion",
      promotable: true,
      recommendedQueueType: "eval_candidate",
      promotionTarget: "eval",
      sourceCandidateIds: ["proof-1", "proof-2"]
    });
    expect(repoFact).toMatchObject({
      candidateCount: 2,
      recommendedAction: "hold_local",
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
    expect(report).toContain("Recommended action: review_for_promotion");
    expect(report).toContain("Promotion strength:");
    expect(report).toContain("Promotable: yes");
    expect(report).toContain("Requires human approval: yes");
    expect(report).not.toContain("approved");
  });

  it("dashboard recommends aggregate pattern review before noisy raw candidates", async () => {
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-dashboard-aggregate-"));
    const pendingDir = path.join(staxRoot, "queues", "sidecar_imports", "pending");
    await fs.mkdir(pendingDir, { recursive: true });
    const candidates = [
      candidate("handoff-raw-first", "evt-1", "Codex handoff prompt should include repo path and exact commands."),
      candidate("visual-1", "evt-2", "Visual/course behavior claims should require rendered screenshot proof; CSS diffs alone are not enough."),
      candidate("visual-2", "evt-3", "Visual proof for layout fixes requires rendered evidence, not source diffs alone.")
    ];
    for (const item of candidates) {
      await fs.writeFile(path.join(pendingDir, `${item.candidateId}.json`), `${JSON.stringify(item, null, 2)}\n`, "utf8");
    }

    const dashboard = await buildSidecarLearningDashboard(staxRoot);

    expect(dashboard.pending).toBe(3);
    expect(dashboard.promotableAggregateGroups).toBe(1);
    expect(dashboard.topAggregateRecommendation).toMatchObject({
      aggregateId: "agg_mode_behavior_rule",
      classification: "mode_behavior_rule",
      candidateCount: 2,
      promotionTarget: "mode_contract_patch"
    });
    expect(dashboard.recommendedNextAction).toContain("agg_mode_behavior_rule");
    expect(dashboard.recommendedNextAction).not.toContain("handoff-raw-first");
  });

  it("dashboard skips aggregate groups that already have reviewed promotion artifacts", async () => {
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-dashboard-reviewed-aggregate-"));
    const pendingDir = path.join(staxRoot, "queues", "sidecar_imports", "pending");
    const proposalDir = path.join(staxRoot, "learning", "proposals", "mode_contract_patch_candidates");
    await fs.mkdir(pendingDir, { recursive: true });
    await fs.mkdir(proposalDir, { recursive: true });
    const candidates = [
      candidate("visual-1", "evt-1", "Visual/course behavior claims should require rendered screenshot proof; CSS diffs alone are not enough."),
      candidate("visual-2", "evt-2", "Visual proof for layout fixes requires rendered evidence, not source diffs alone."),
      candidate("proof-1", "evt-3", "wrong repo command output must not verify target repo."),
      candidate("proof-2", "evt-4", "Codex report lacks file list, diff, and command output.")
    ];
    for (const item of candidates) {
      await fs.writeFile(path.join(pendingDir, `${item.candidateId}.json`), `${JSON.stringify(item, null, 2)}\n`, "utf8");
    }
    await fs.writeFile(
      path.join(proposalDir, "agg_mode_behavior_rule.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-reviewed-aggregate-promotion-v1",
          aggregateId: "agg_mode_behavior_rule",
          status: "approved_for_promotion"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const dashboard = await buildSidecarLearningDashboard(staxRoot);

    expect(dashboard.promotableAggregateGroups).toBe(2);
    expect(dashboard.reviewedAggregateGroups).toBe(1);
    expect(dashboard.topAggregateRecommendation).toMatchObject({
      aggregateId: "agg_proof_boundary_rule",
      classification: "proof_boundary_rule",
      candidateCount: 2,
      promotionTarget: "eval"
    });
    expect(dashboard.recommendedNextAction).toContain("agg_proof_boundary_rule");
    expect(dashboard.recommendedNextAction).not.toContain("agg_mode_behavior_rule");
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
