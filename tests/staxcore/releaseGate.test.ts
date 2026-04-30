import { describe, expect, it } from "vitest";
import { evaluateReleaseGate } from "../../src/staxcore/index.js";

describe("staxcore release gate", () => {
  it("passes when all required checks pass", () => {
    const result = evaluateReleaseGate({
      typecheckPassed: true,
      testsPassed: true,
      doctrineAuditPassed: true,
      boundaryAuditPassed: true,
      securityAuditPassed: true,
      replayPassed: true,
      replayDeterministic: true,
      replayChainValid: true
    });

    expect(result.canRelease).toBe(true);
    expect(result.profile).toBe("standard");
    expect(result.failedChecks).toEqual([]);
  });

  it("blocks release when any required check fails", () => {
    const result = evaluateReleaseGate({
      typecheckPassed: true,
      testsPassed: false,
      doctrineAuditPassed: true,
      boundaryAuditPassed: true,
      securityAuditPassed: true,
      replayPassed: false,
      replayDeterministic: false,
      replayChainValid: false
    });

    expect(result.canRelease).toBe(false);
    expect(result.failedChecks).toContain("tests");
    expect(result.failedChecks).toContain("replay");
  });

  it("blocks strict profile when eval checks are missing", () => {
    const result = evaluateReleaseGate(
      {
        typecheckPassed: true,
        testsPassed: true,
        doctrineAuditPassed: true,
        boundaryAuditPassed: true,
        securityAuditPassed: true,
        replayPassed: true
      },
      "strict"
    );

    expect(result.canRelease).toBe(false);
    expect(result.profile).toBe("strict");
    expect(result.failedChecks).toContain("eval");
    expect(result.failedChecks).toContain("regressionEval");
    expect(result.failedChecks).toContain("redteamEval");
  });
});
