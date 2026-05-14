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
    expect(review).toContain("Pattern classification");
    expect(review).toContain("Recommended queue");
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

  it("skips non-learning sidecar event schemas instead of failing harvest", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-harvest-mixed-events-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-mixed-events-"));
    await attachStaxToRepo(repoPath);
    await writeSidecarLearningEvent(repoPath, baseEvent("evt_eval", "regression_eval", "global"));
    await fs.writeFile(
      path.join(repoPath, ".stax", "events", "proof-surface-approved-2026-05-14T00-00-00-000Z.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-proof-surface-approval-event-v1",
          approvedAt: "2026-05-14T00:00:00.000Z",
          proofSurfaceCount: 3
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(repoPath, ".stax", "events", "preflight_preflight_2026-05-14T00_01_00_000Z.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-preflight-event-v1",
          generatedAt: "2026-05-14T00:01:00.000Z",
          verdict: "Reject",
          enforcement: "observer"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);

    expect(harvested.imported).toBe(1);
    expect(harvested.skippedNonLearningEvents).toBe(2);
    expect(harvested.skippedEvents.map((event) => event.reason)).toEqual(
      expect.arrayContaining(["non_learning_schema"])
    );
    expect(pending).toHaveLength(1);
  });

  it("does not materialize trace-only command evidence as learning candidates", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-harvest-trace-events-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-trace-events-"));
    await attachStaxToRepo(repoPath);
    await writeSidecarLearningEvent(repoPath, baseEvent("evt_trace", "none", "none"));

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);

    expect(harvested.imported).toBe(0);
    expect(harvested.skippedTraceEvents).toBe(1);
    expect(pending).toHaveLength(0);
  });

  it("extracts course-deploy proof lessons from latest sidecar status", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-harvest-status-lessons-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-status-lessons-"));
    await attachStaxToRepo(repoPath);
    await fs.writeFile(
      path.join(repoPath, ".stax", "status.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-status-v1",
          generatedAt: "2026-05-14T17:27:26.174Z",
          repo: "canvas-helper",
          repoPath,
          branch: "main",
          commitSha: "abc123",
          task: "Redeploy Forensics 25 Google-hosted course after image cleanup.",
          verdict: "Reject",
          why: "Claim-to-proof: release_deploy claim is unsupported because target_environment_proof and build_proof.",
          verified: ["Claim-to-proof: visual claim is fully supported."],
          weak: ["Proof strength: Provisional - A local STAX command label is only strong proof after provenance verification."],
          unverified: [
            "Command evidence provenance is not verified: wrong_worktree.",
            "STAX acknowledgement is stale or does not match the current turn contract.",
            "Unsupported file_path claim: workspace/export."
          ],
          risk: ["Unsupported hard claim: release_deploy requires build_proof."],
          oneNextAction: "Capture rendered visual proof and run npm run smoke:pipeline through stax:collect.",
          proofStrength: {
            claimType: "release_ready",
            label: "Provisional",
            finalScore: 0.69,
            primaryLimiter: "A local STAX command label is only strong proof after provenance verification.",
            capApplied: [{ id: "unverified_local_command_provenance" }]
          },
          protocolStatus: "failure"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);

    expect(harvested.imported).toBe(1);
    expect(pending[0]!.summary).toContain("Course deploy claims need a dedicated proof contract");
    expect(pending[0]!.summary).toContain("Claim parsing should not treat URLs, prose slash phrases");
    expect(pending[0]!.candidateType).toBe("regression_eval");
    expect(pending[0]!.scope).toBe("archetype");
  });

  it("harvests codex reports as repo-memory candidates without promoting", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-report-harvest-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-report-"));
    await attachStaxToRepo(repoPath);
    await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), codexReport("Prefer QTI visual export"), "utf8");

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);

    expect(harvested.imported).toBe(1);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.candidateType).toBe("repo_memory");
    expect(pending[0]!.scope).toBe("repo");
    expect(pending[0]!.summary).toContain("Prefer QTI visual export");
    expect(pending[0]!.proposedArtifact?.destinationHint).toBe("memory/candidates/");
    expect(pending[0]!.proposedArtifact?.payload).toMatchObject({
      sourceKind: "codex_report",
      sections: expect.objectContaining({
        objective: "Prefer QTI visual export",
        verified: "- QTI item structure produced real Google Forms controls.",
        oneNextAction: "Use the QTI visual route before PDF crops when Common Cartridge data exists."
      })
    });
    await expect(fs.readdir(path.join(staxRoot, "memory", "candidates"))).rejects.toThrow();
  });

  it("parses older bare-heading codex reports without section bleed", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-bare-report-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-bare-report-"));
    await attachStaxToRepo(repoPath);
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective",
        "Reject script existence as proof.",
        "",
        "Files changed",
        "- .stax/codex-report.md",
        "",
        "Tests added",
        "- None.",
        "",
        "Commands run",
        "- `npm run build`",
        "",
        "Command output summary with exit codes",
        "- Build exit 0.",
        "",
        "What is verified",
        "- Command output exists.",
        "",
        "What is weak/provisional",
        "- Live form not opened.",
        "",
        "What is unverified",
        "- Browser view.",
        "",
        "Risks",
        "- Fake proof.",
        "",
        "One next action",
        "Run the actual proof command."
      ].join("\n"),
      "utf8"
    );

    await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);
    const sections = pending[0]!.proposedArtifact?.payload.sections as Record<string, string>;

    expect(sections.objective).toBe("Reject script existence as proof.");
    expect(sections.filesChanged).toBe("- .stax/codex-report.md");
    expect(sections.verified).toBe("- Command output exists.");
    expect(sections.objective).not.toContain("Files changed");
  });

  it("does not duplicate codex report candidates across repeated harvests", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-report-dedupe-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-report-dedupe-"));
    await attachStaxToRepo(repoPath);
    await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), codexReport("Chunk large Google Forms batches"), "utf8");

    const first = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const second = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const pending = await listSidecarImportCandidates(staxRoot);

    expect(first.imported).toBe(1);
    expect(second.imported).toBe(0);
    expect(pending).toHaveLength(1);
  });

  it("backfills repo-matched codex report writes from session logs without raw transcript payloads", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-session-report-");
    const otherRepoPath = await createTempGitRepo("stax-sidecar-other-report-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-session-report-"));
    const sessionsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-sessions-"));
    await attachStaxToRepo(repoPath);
    await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), "", "utf8");
    await writeSessionLog(sessionsRoot, [
      sessionMeta("session-brightspace"),
      turnContext(repoPath),
      assistantMessage("raw transcript text that should not be copied"),
      reportPatch(repoPath, codexReport("Reject script existence as proof")),
      turnContext(otherRepoPath),
      reportPatch(otherRepoPath, codexReport("Ignore other repo report"))
    ]);

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot, sessionsRoot });
    const pending = await listSidecarImportCandidates(staxRoot);

    expect(harvested.imported).toBe(1);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.summary).toContain("Reject script existence as proof");
    const payloadText = JSON.stringify(pending[0]!.proposedArtifact?.payload);
    expect(payloadText).toContain("codex_session_report");
    expect(payloadText).not.toContain("raw transcript text that should not be copied");
    expect(payloadText).not.toContain("Ignore other repo report");
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

  it("routes promoted repo-memory candidates by reviewed promotion target", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-promote-target-");
    const staxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stax-central-promote-target-"));
    await attachStaxToRepo(repoPath);
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      codexReportWithCodeAndTests(
        "Wrong repo command output must not verify the target repo.",
        "- src/evidence/ProofGate.ts\n- tests/proofGate.test.ts",
        "- Added target-repo proof boundary regression coverage.",
        "- `npm test -- tests/proofGate.test.ts`\n- `npm run gate:repo-proof`",
        "- Tests passed exit 0.\n- Gate run passed exit 0.\n- Real command evidence was collected.",
        "- Verified target-repo proof boundary enforcement.",
        "Add the wrong-repo proof boundary to the durable eval set."
      ),
      "utf8"
    );

    const harvested = await harvestSidecarEvents({ fromRepoPath: repoPath, staxRoot });
    const candidateId = harvested.candidates[0]!.candidateId;
    const result = await promoteSidecarImport({
      candidateId,
      approve: true,
      staxRoot
    });
    const promotedArtifact = JSON.parse(await fs.readFile(result.artifactPath, "utf8")) as {
      decision: { promotionTarget: string; recommendedAction: string };
    };

    expect(result.artifactPath).toContain(path.join("evals", "candidates"));
    expect(promotedArtifact.decision.promotionTarget).toBe("eval");
    expect(promotedArtifact.decision.recommendedAction).toBe("review_for_promotion");
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

function codexReport(objective: string): string {
  return [
    "# Codex Report",
    "",
    "## Objective",
    objective,
    "",
    "## Files changed",
    "- `src/example.ts`",
    "",
    "## Tests added",
    "- `tests/example.test.ts`",
    "",
    "## Commands run",
    "- `npm run build`",
    "",
    "## Command output summary with exit codes",
    "- `npm run build`: exit 0",
    "",
    "## What is verified",
    "- QTI item structure produced real Google Forms controls.",
    "",
    "## What is weak/provisional",
    "- Live editor visual inspection is still pending.",
    "",
    "## What is unverified",
    "- Every generated form has not been manually opened.",
    "",
    "## Risks",
    "- Large banks can exceed bridge limits.",
    "",
    "## One next action",
    "Use the QTI visual route before PDF crops when Common Cartridge data exists.",
    ""
  ].join("\n");
}

function codexReportWithCodeAndTests(
  objective: string,
  filesChanged: string,
  testsAdded: string,
  commandsRun: string,
  outputSummary: string,
  verified: string,
  oneNextAction: string
): string {
  return [
    "# Codex Report",
    "",
    "## Objective",
    objective,
    "",
    "## Files Changed",
    filesChanged,
    "",
    "## Tests Added",
    testsAdded,
    "",
    "## Commands Run",
    commandsRun,
    "",
    "## Command Output Summary With Exit Codes",
    outputSummary,
    "",
    "## What Is Verified",
    verified,
    "",
    "## What Is Weak/Provisional",
    "- None.",
    "",
    "## What Is Unverified",
    "- None.",
    "",
    "## Risks",
    "- None.",
    "",
    "## One Next Action",
    oneNextAction
  ].join("\n");
}

async function writeSessionLog(sessionsRoot: string, events: unknown[]): Promise<void> {
  const dayDir = path.join(sessionsRoot, "2026", "05", "08");
  await fs.mkdir(dayDir, { recursive: true });
  await fs.writeFile(
    path.join(dayDir, "rollout-2026-05-08T00-00-00-session-brightspace.jsonl"),
    events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    "utf8"
  );
}

function sessionMeta(id: string): unknown {
  return {
    timestamp: "2026-05-08T00:00:00.000Z",
    type: "session_meta",
    payload: { id }
  };
}

function turnContext(cwd: string): unknown {
  return {
    timestamp: "2026-05-08T00:00:01.000Z",
    type: "turn_context",
    payload: { cwd }
  };
}

function assistantMessage(text: string): unknown {
  return {
    timestamp: "2026-05-08T00:00:02.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }]
    }
  };
}

function reportPatch(repoPath: string, content: string): unknown {
  return {
    timestamp: "2026-05-08T00:00:03.000Z",
    type: "event_msg",
    payload: {
      type: "patch_apply_end",
      changes: {
        [path.join(repoPath, ".stax", "codex-report.md")]: {
          type: "update",
          content
        }
      }
    }
  };
}
