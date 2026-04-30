import { describe, expect, it } from "vitest";
import type { StaxCoreReleaseArtifact } from "../../src/staxcore/index.js";
import {
  buildPromotionReadinessSummary,
  renderReleaseMarkdownReport,
  summarizeDoctrineTrend
} from "../../src/staxcore/index.js";

describe("staxcore release markdown report", () => {
  it("renders promotion-ready packet with trend details", () => {
    const artifact: StaxCoreReleaseArtifact = {
      artifactId: "artifact-1",
      createdAt: "2026-04-30T10:00:00Z",
      doctrineVersion: "core-v1",
      commandChecks: [
        {
          name: "typecheck",
          command: "npm run typecheck",
          passed: true,
          exitCode: 0,
          durationMs: 123,
          stdoutPreview: "ok",
          stderrPreview: ""
        }
      ],
      evidence: {
        typecheckPassed: true,
        testsPassed: true,
        doctrineAuditPassed: true,
        boundaryAuditPassed: true,
        securityAuditPassed: true,
        replayPassed: true,
        replayDeterministic: true,
        replayChainValid: true
      },
      replay: {
        deterministic: true,
        chainValid: true,
        runOutputHashes: ["a"],
        controlOutputHashes: ["a"],
        ledgerHashes: ["h"],
        chainIssues: []
      },
      releaseGate: {
        canRelease: true,
        profile: "standard",
        requiredChecks: {},
        failedChecks: [],
        summary: "pass"
      },
      doctrineCompliance: {
        score: 100,
        grade: "A",
        breakdown: {},
        notes: []
      }
    };

    const trend = summarizeDoctrineTrend([{ path: "latest.json", artifact }], 0);
    const promotion = buildPromotionReadinessSummary({
      releaseGate: artifact.releaseGate,
      doctrineTrend: trend,
      doctrineCompliance: artifact.doctrineCompliance
    });
    const markdown = renderReleaseMarkdownReport({
      artifact,
      artifactPath: "runs/staxcore_release/date/artifact-1.json",
      trend,
      promotion
    });

    expect(markdown).toContain("# STAX Core Release Gate Report");
    expect(markdown).toContain("Can Promote: yes");
    expect(markdown).toContain("Artifact: runs/staxcore_release/date/artifact-1.json");
    expect(markdown).toContain("Release Profile: standard");
  });
});
