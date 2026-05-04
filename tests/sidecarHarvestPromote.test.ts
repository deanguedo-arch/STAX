import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { harvestSidecarEvents } from "../src/learning/SidecarHarvest.js";
import { promoteSidecarImport } from "../src/learning/SidecarImportPromotion.js";
import { listSidecarImportCandidates, renderSidecarImportReview } from "../src/learning/SidecarImportReview.js";
import { buildSidecarLearningDashboard } from "../src/learning/SidecarLearningDashboard.js";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import type { SidecarLearningEvent } from "../src/sidecar/SidecarLearningEvent.js";
import { writeSidecarLearningEvent } from "../src/sidecar/SidecarLearningWriter.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

describe("STAX sidecar harvest, review, promote, and dashboard", () => {
  it("harvests pending candidates without promoting", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-harvest-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-"));
    await attachStaxToRepo(repoPath);
    await writeSidecarLearningEvent(repoPath, baseEvent("evt_eval", "regression_eval", "global"));

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);
    const review = renderSidecarImportReview(pending);

    expect(harvested.imported).toBe(1);
    expect(pending).toHaveLength(1);
    expect(review).toContain("Decision required");
    await expect(fs.readdir(path.join(staxRoot, "evals", "candidates"))).rejects.toThrow();
  });

  it("skips privacy-blocked events", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-harvest-blocked-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-blocked-"));
    await attachStaxToRepo(repoPath);
    const blocked = baseEvent("evt_blocked", "regression_eval", "global");
    blocked.privacy = { redactionStatus: "blocked", redactionNotes: ["secret"] };
    await fs.writeFile(
      path.join(repoPath, ".stax", "events", "evt_blocked.json"),
      `${JSON.stringify(blocked, null, 2)}\n`,
      "utf8"
    );

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });

    expect(harvested.imported).toBe(0);
    expect(harvested.skippedPrivacyBlocked).toBe(1);
  });

  it("promotes only with approval and keeps repo memory repo-scoped", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-promote-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-promote-"));
    await attachStaxToRepo(repoPath);
    await writeSidecarLearningEvent(repoPath, baseEvent("evt_memory", "repo_memory", "repo"));
    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const candidateId = harvested.candidates[0]!.candidateId;

    await expect(
      promoteSidecarImport({
        candidateId,
        approve: false,
        staxRoot
      })
    ).rejects.toThrow(/requires --approve/);

    const result = await promoteSidecarImport({
      candidateId,
      approve: true,
      staxRoot
    });

    expect(result.artifactPath).toContain(path.join("memory", "candidates"));
    await expect(fs.stat(path.join(staxRoot, "queues", "sidecar_imports", "promoted", `${candidateId}.json`))).resolves.toBeTruthy();
  });

  it("blocks global single-event failure pattern promotion without override and summarizes dashboard", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-failure-pattern-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-pattern-"));
    await attachStaxToRepo(repoPath);
    await writeSidecarLearningEvent(repoPath, baseEvent("evt_pattern", "failure_pattern", "global"));
    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const candidateId = harvested.candidates[0]!.candidateId;

    await expect(
      promoteSidecarImport({
        candidateId,
        approve: true,
        staxRoot
      })
    ).rejects.toThrow(/requires --allow-single-event/);

    const dashboard = await buildSidecarLearningDashboard(staxRoot);
    expect(dashboard.pending).toBe(1);
    expect(dashboard.usefulBlocks).toBe(1);
  });
});

function baseEvent(
  id: string,
  target: SidecarLearningEvent["promotion"]["target"],
  scope: SidecarLearningEvent["promotion"]["scope"]
): SidecarLearningEvent {
  return {
    eventId: id,
    eventType: "missing_proof_caught",
    schemaVersion: "sidecar-learning-v1",
    createdAt: "2026-05-04T00:00:00.000Z",
    sourceRepo: {
      name: "external-repo",
      pathHash: "abcdef1234567890",
      branch: "main",
      commitSha: "abc123"
    },
    task: {
      taskId: "task_001",
      objective: "block fake complete",
      finalOutcome: "rejected_fake_complete"
    },
    stax: {
      verdict: "Reject",
      useful: true,
      falseAccept: false,
      falseBlock: false,
      usefulBlock: true,
      verifiedAccept: false
    },
    evidence: {
      changedFileRoles: ["docs"],
      commandProofStrengths: ["none"],
      claimTypes: ["implementation"],
      failurePatternIds: ["docs_only_implementation_claim"]
    },
    promotion: {
      suggested: target !== "none",
      target,
      scope,
      rationale: "Docs-only implementation claim should become a reviewed candidate."
    },
    privacy: {
      redactionStatus: "clean",
      redactionNotes: []
    }
  };
}
