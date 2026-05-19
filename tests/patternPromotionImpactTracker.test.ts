import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPatternPromotionImpactReport,
  evaluateImportedEvidenceBundle,
  evaluateLockedReplayCase,
  readLockedReplayImpactFixture,
  renderPatternPromotionImpactReport
} from "../src/learning/PatternPromotionImpactTracker.js";
import type { StaxImpactEvidenceBundle } from "../src/learning/PatternPromotionImpactSchemas.js";

describe("PatternPromotionImpactTracker", () => {
  it("runs the ten locked replay cases without mixing in live repo claims", async () => {
    const fixture = await readLockedReplayImpactFixture(path.join(process.cwd(), "fixtures", "pattern_promotion", "locked_replay_10_cases.json"));
    const report = buildPatternPromotionImpactReport({ lockedReplayFixture: fixture, generatedAt: "2026-05-19T00:00:00.000Z" });

    expect(report.lockedReplay.caseCount).toBe(10);
    expect(report.lockedReplay.criticalMisses).toBe(0);
    expect(report.lockedReplay.improved).toBe(8);
    expect(report.lockedReplay.unchangedSafe).toBe(2);
    expect(report.currentOperatingWindow.importedBundleCount).toBe(0);
    expect(report.lockedReplay.claim).toContain("frozen prompts and evidence");
    expect(report.currentOperatingWindow.claim).toContain("live repos today");
  });

  it("marks an expected-decision mismatch as a locked replay regression", async () => {
    const fixture = await readLockedReplayImpactFixture(path.join(process.cwd(), "fixtures", "pattern_promotion", "locked_replay_10_cases.json"));
    const result = evaluateLockedReplayCase({
      ...fixture.cases[0],
      expectedDecision: {
        classification: "trace_fact",
        recommendedAction: "discard",
        promotionTarget: "none",
        promotable: false
      }
    });

    expect(result.outcome).toBe("regressed");
    expect(result.criticalMiss).toBe(true);
    expect(result.failures.join("\n")).toContain("classification expected trace_fact");
  });

  it("imports current operating evidence as a separate live-repo result", () => {
    const bundle = sampleBundle({
      repoName: "canvas-helper",
      criticalMiss: false,
      fullHandoffContractPresent: true,
      proofArtifactRequested: true,
      cleanupPromptNeeded: true
    });
    const result = evaluateImportedEvidenceBundle(bundle);

    expect(result.repo).toBe("canvas-helper");
    expect(result.outcome).toBe("improved");
    expect(result.cleanupPromptNeeded).toBe(true);
    expect(result.commandEvidenceCount).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it("does not count incomplete live bundles as locked replay failures", async () => {
    const fixture = await readLockedReplayImpactFixture(path.join(process.cwd(), "fixtures", "pattern_promotion", "locked_replay_10_cases.json"));
    const report = buildPatternPromotionImpactReport({
      lockedReplayFixture: fixture,
      importedEvidenceBundles: [
        sampleBundle({
          repoName: "brightspacequizexporter",
          criticalMiss: false,
          fullHandoffContractPresent: false,
          proofArtifactRequested: false,
          cleanupPromptNeeded: true
        })
      ],
      generatedAt: "2026-05-19T00:00:00.000Z"
    });

    expect(report.lockedReplay.criticalMisses).toBe(0);
    expect(report.currentOperatingWindow.importedBundleCount).toBe(1);
    expect(report.currentOperatingWindow.results[0].outcome).toBe("unchanged_safe");
    expect(report.currentOperatingWindow.results[0].failures).toEqual(
      expect.arrayContaining(["full handoff contract missing", "proof artifact not requested"])
    );
  });

  it("renders the report with explicit claim separation", async () => {
    const fixture = await readLockedReplayImpactFixture(path.join(process.cwd(), "fixtures", "pattern_promotion", "locked_replay_10_cases.json"));
    const report = buildPatternPromotionImpactReport({ lockedReplayFixture: fixture, generatedAt: "2026-05-19T00:00:00.000Z" });
    const markdown = renderPatternPromotionImpactReport(report);

    expect(markdown).toContain("## Claim Separation");
    expect(markdown).toContain("Locked replay does not prove live repo usefulness");
    expect(markdown).toContain("none imported yet");
  });

  it("keeps the fixture parseable as committed JSON", async () => {
    const raw = await fs.readFile(path.join(process.cwd(), "fixtures", "pattern_promotion", "locked_replay_10_cases.json"), "utf8");
    expect(JSON.parse(raw).cases).toHaveLength(10);
  });
});

function sampleBundle(options: {
  repoName: string;
  criticalMiss: boolean;
  cleanupPromptNeeded: boolean;
  fullHandoffContractPresent: boolean;
  proofArtifactRequested: boolean;
}): StaxImpactEvidenceBundle {
  return {
    schemaVersion: "stax-impact-evidence-bundle-v1",
    generatedAt: "2026-05-19T00:00:00.000Z",
    repo: {
      path: `/tmp/${options.repoName}`,
      name: options.repoName,
      branch: "main",
      head: "abc123",
      dirtyStatus: ""
    },
    stax: {
      commit: "stax123",
      sidecarProtocolVersion: "stax-project-control-protocol-v1",
      proofSurfaceVersion: "stax-proof-surface-pack-v1"
    },
    task: "Run sidecar proof gate.",
    staxOutput: "Status: Accept\nProof strength: Audit-grade",
    codexReport: "STAX acknowledgement\nObjective\nCommands run\nWhat is verified",
    commandEvidence: [
      {
        evidenceId: "cmd_1",
        command: "npm test",
        exitCode: 0,
        source: "local_stax_command_output",
        provenanceStatus: "verified_local_stax_command"
      }
    ],
    artifacts: [{ kind: "status", path: ".stax/status.json" }],
    criticalMiss: options.criticalMiss,
    cleanupPromptNeeded: options.cleanupPromptNeeded,
    fullHandoffContractPresent: options.fullHandoffContractPresent,
    proofArtifactRequested: options.proofArtifactRequested
  };
}
