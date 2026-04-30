import { describe, expect, it } from "vitest";
import type { StaxCoreReleaseArtifact } from "../../src/staxcore/index.js";
import {
  buildPromotionReadinessSummary,
  summarizeDoctrineTrend
} from "../../src/staxcore/index.js";

function artifact(score: number, createdAt: string, canRelease = true): StaxCoreReleaseArtifact {
  return {
    artifactId: `artifact-${score}-${createdAt}`,
    createdAt,
    doctrineVersion: "core-v1",
    commandChecks: [],
    evidence: {
      typecheckPassed: canRelease,
      testsPassed: canRelease,
      doctrineAuditPassed: canRelease,
      boundaryAuditPassed: canRelease,
      securityAuditPassed: canRelease,
      replayPassed: canRelease
    },
    replay: {
      deterministic: canRelease,
      chainValid: canRelease,
      runOutputHashes: [],
      controlOutputHashes: [],
      ledgerHashes: [],
      chainIssues: canRelease ? [] : ["failed"]
    },
    releaseGate: {
      canRelease,
      profile: "standard",
      requiredChecks: {},
      failedChecks: canRelease ? [] : ["tests"],
      summary: canRelease ? "ok" : "blocked"
    },
    doctrineCompliance: {
      score,
      grade: score >= 90 ? "A" : score >= 80 ? "B" : "C",
      breakdown: {},
      notes: []
    }
  };
}

describe("staxcore doctrine trend", () => {
  it("detects score regression beyond allowed drop", () => {
    const trend = summarizeDoctrineTrend(
      [
        { path: "runs/staxcore_release/latest.json", artifact: artifact(90, "2026-04-30T10:00:00Z") },
        { path: "runs/staxcore_release/prev.json", artifact: artifact(96, "2026-04-29T10:00:00Z") }
      ],
      0
    );

    expect(trend.regression.detected).toBe(true);
    expect(trend.scoreDeltaFromPrevious).toBe(-6);
  });

  it("builds promotion summary with regression blocker", () => {
    const latest = artifact(88, "2026-04-30T10:00:00Z");
    const previous = artifact(95, "2026-04-29T10:00:00Z");
    const trend = summarizeDoctrineTrend(
      [
        { path: "latest.json", artifact: latest },
        { path: "prev.json", artifact: previous }
      ],
      0
    );
    const summary = buildPromotionReadinessSummary({
      releaseGate: latest.releaseGate,
      doctrineTrend: trend,
      doctrineCompliance: latest.doctrineCompliance
    });

    expect(summary.canPromote).toBe(false);
    expect(summary.blockers.some((item) => item.includes("Doctrine score dropped"))).toBe(true);
  });
});
