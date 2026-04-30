export interface ReleaseGateEvidence {
  typecheckPassed: boolean;
  testsPassed: boolean;
  doctrineAuditPassed: boolean;
  boundaryAuditPassed: boolean;
  securityAuditPassed: boolean;
  replayPassed: boolean;
  evalPassed?: boolean;
  regressionEvalPassed?: boolean;
  redteamEvalPassed?: boolean;
  replayDeterministic?: boolean;
  replayChainValid?: boolean;
}

export type ReleaseGateProfile = "standard" | "strict";

export interface ReleaseGateResult {
  canRelease: boolean;
  profile: ReleaseGateProfile;
  requiredChecks: Record<string, boolean>;
  failedChecks: string[];
  summary: string;
}

export function evaluateReleaseGate(
  evidence: ReleaseGateEvidence,
  profile: ReleaseGateProfile = "standard"
): ReleaseGateResult {
  const requiredChecks: Record<string, boolean> = {
    typecheck: evidence.typecheckPassed,
    tests: evidence.testsPassed,
    doctrineAudit: evidence.doctrineAuditPassed,
    boundaryAudit: evidence.boundaryAuditPassed,
    securityAudit: evidence.securityAuditPassed,
    replay: evidence.replayPassed
  };

  if (profile === "strict") {
    requiredChecks.eval = evidence.evalPassed === true;
    requiredChecks.regressionEval = evidence.regressionEvalPassed === true;
    requiredChecks.redteamEval = evidence.redteamEvalPassed === true;
  }

  // Replay details are advisory diagnostics in this phase but still captured.
  if (typeof evidence.replayDeterministic === "boolean") {
    requiredChecks.replayDeterministic = evidence.replayDeterministic;
  }
  if (typeof evidence.replayChainValid === "boolean") {
    requiredChecks.replayChainValid = evidence.replayChainValid;
  }

  const failedChecks = Object.entries(requiredChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    canRelease: failedChecks.length === 0,
    profile,
    requiredChecks,
    failedChecks,
    summary:
      failedChecks.length === 0
        ? `Release gate (${profile}) passed.`
        : `Release gate (${profile}) blocked. Failed checks: ${failedChecks.join(", ")}`
  };
}
