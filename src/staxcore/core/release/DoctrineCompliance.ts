import type { ReplayPipelineResult } from "../replay/replayPipeline.js";
import type { ReleaseGateEvidence, ReleaseGateResult } from "./ReleaseGate.js";

export interface DoctrineComplianceReport {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: Record<string, number>;
  notes: string[];
}

export interface DoctrineComplianceInput {
  releaseGate: ReleaseGateResult;
  evidence: ReleaseGateEvidence;
  replay: ReplayPipelineResult;
  redteamFixtureCount: number;
  goldenFixtureCount: number;
}

function gradeForScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function checkScore(passed: boolean, points: number): number {
  return passed ? points : 0;
}

export function scoreDoctrineCompliance(
  input: DoctrineComplianceInput
): DoctrineComplianceReport {
  const breakdown: Record<string, number> = {
    typecheck: checkScore(input.evidence.typecheckPassed, 12),
    tests: checkScore(input.evidence.testsPassed, 12),
    doctrineAudit: checkScore(input.evidence.doctrineAuditPassed, 12),
    boundaryAudit: checkScore(input.evidence.boundaryAuditPassed, 12),
    securityAudit: checkScore(input.evidence.securityAuditPassed, 12),
    replayPass: checkScore(input.evidence.replayPassed, 12),
    replayDeterministic: checkScore(input.replay.deterministic, 8),
    replayChainValid: checkScore(input.replay.chainValid, 8),
    redteamFixtures: checkScore(input.redteamFixtureCount >= 6, 6),
    goldenFixtures: checkScore(input.goldenFixtureCount >= 4, 6)
  };

  const score = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  const notes: string[] = [];

  if (!input.releaseGate.canRelease) {
    notes.push(`Release gate blocked: ${input.releaseGate.failedChecks.join(", ")}`);
  }
  if (!input.replay.deterministic) {
    notes.push("Replay is not deterministic.");
  }
  if (!input.replay.chainValid) {
    notes.push("Replay ledger hash chain is invalid.");
  }
  if (input.redteamFixtureCount < 6) {
    notes.push("Red-team fixture coverage is below minimum.");
  }
  if (input.goldenFixtureCount < 4) {
    notes.push("Golden fixture coverage is below minimum.");
  }

  return {
    score,
    grade: gradeForScore(score),
    breakdown,
    notes
  };
}
