import type { DoctrineComplianceReport } from "./DoctrineCompliance.js";
import type { ReleaseGateResult } from "./ReleaseGate.js";
import type { ReleaseArtifactSnapshot } from "./ReleaseArtifactStore.js";

export interface DoctrineTrendEntry {
  artifactId: string;
  createdAt: string;
  score: number;
  grade: DoctrineComplianceReport["grade"];
  canRelease: boolean;
  path: string;
}

export interface DoctrineTrendReport {
  entries: DoctrineTrendEntry[];
  latest: DoctrineTrendEntry | null;
  previous: DoctrineTrendEntry | null;
  averageScore: number | null;
  scoreDeltaFromPrevious: number | null;
  regression: {
    detected: boolean;
    drop: number;
    maxAllowedDrop: number;
    reason?: string;
  };
}

export interface PromotionReadinessSummary {
  canPromote: boolean;
  blockers: string[];
  summary: string;
}

export function summarizeDoctrineTrend(
  snapshots: ReleaseArtifactSnapshot[],
  maxAllowedDrop = 0
): DoctrineTrendReport {
  const entries = snapshots.map((snapshot) => ({
    artifactId: snapshot.artifact.artifactId,
    createdAt: snapshot.artifact.createdAt,
    score: snapshot.artifact.doctrineCompliance.score,
    grade: snapshot.artifact.doctrineCompliance.grade,
    canRelease: snapshot.artifact.releaseGate.canRelease,
    path: snapshot.path
  }));

  const latest = entries[0] ?? null;
  const previous = entries[1] ?? null;
  const averageScore =
    entries.length > 0
      ? Number(
          (
            entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length
          ).toFixed(2)
        )
      : null;
  const scoreDeltaFromPrevious =
    latest && previous ? latest.score - previous.score : null;
  const drop =
    scoreDeltaFromPrevious !== null && scoreDeltaFromPrevious < 0
      ? Math.abs(scoreDeltaFromPrevious)
      : 0;
  const regressionDetected =
    scoreDeltaFromPrevious !== null && latest !== null && previous !== null
      ? latest.score < previous.score - maxAllowedDrop
      : false;

  return {
    entries,
    latest,
    previous,
    averageScore,
    scoreDeltaFromPrevious,
    regression: {
      detected: regressionDetected,
      drop,
      maxAllowedDrop,
      reason: regressionDetected
        ? `Doctrine score dropped from ${previous?.score} to ${latest?.score}.`
        : undefined
    }
  };
}

export function buildPromotionReadinessSummary(args: {
  releaseGate: ReleaseGateResult;
  doctrineTrend: DoctrineTrendReport;
  doctrineCompliance: DoctrineComplianceReport;
}): PromotionReadinessSummary {
  const blockers: string[] = [];

  if (!args.releaseGate.canRelease) {
    blockers.push(`Release gate blocked: ${args.releaseGate.failedChecks.join(", ")}`);
  }
  if (args.doctrineTrend.regression.detected) {
    blockers.push(args.doctrineTrend.regression.reason ?? "Doctrine score regression detected.");
  }
  if (args.doctrineCompliance.grade === "D" || args.doctrineCompliance.grade === "F") {
    blockers.push(`Doctrine compliance grade too low: ${args.doctrineCompliance.grade}.`);
  }

  return {
    canPromote: blockers.length === 0,
    blockers,
    summary:
      blockers.length === 0
        ? "Promotion-ready: release gate passed with no doctrine regression."
        : `Promotion blocked: ${blockers.join(" | ")}`
  };
}
