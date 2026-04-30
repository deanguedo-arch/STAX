import { describe, expect, it } from "vitest";
import {
  evaluateReleaseGate,
  scoreDoctrineCompliance
} from "../../src/staxcore/index.js";

describe("staxcore doctrine compliance scoring", () => {
  it("scores high when release checks and replay pass", () => {
    const evidence = {
      typecheckPassed: true,
      testsPassed: true,
      doctrineAuditPassed: true,
      boundaryAuditPassed: true,
      securityAuditPassed: true,
      replayPassed: true,
      replayDeterministic: true,
      replayChainValid: true
    };
    const releaseGate = evaluateReleaseGate(evidence);
    const report = scoreDoctrineCompliance({
      evidence,
      releaseGate,
      replay: {
        deterministic: true,
        chainValid: true,
        runOutputHashes: ["a", "b"],
        controlOutputHashes: ["a", "b"],
        ledgerHashes: ["h1", "h2"],
        chainIssues: []
      },
      redteamFixtureCount: 6,
      goldenFixtureCount: 4
    });

    expect(report.score).toBe(100);
    expect(report.grade).toBe("A");
    expect(report.notes).toEqual([]);
  });

  it("adds notes and lowers score when evidence is incomplete", () => {
    const evidence = {
      typecheckPassed: true,
      testsPassed: false,
      doctrineAuditPassed: true,
      boundaryAuditPassed: false,
      securityAuditPassed: true,
      replayPassed: false,
      replayDeterministic: false,
      replayChainValid: false
    };
    const releaseGate = evaluateReleaseGate(evidence);
    const report = scoreDoctrineCompliance({
      evidence,
      releaseGate,
      replay: {
        deterministic: false,
        chainValid: false,
        runOutputHashes: [],
        controlOutputHashes: [],
        ledgerHashes: [],
        chainIssues: ["mismatch"]
      },
      redteamFixtureCount: 2,
      goldenFixtureCount: 1
    });

    expect(report.score).toBeLessThan(70);
    expect(report.grade).toMatch(/[DF]/);
    expect(report.notes.length).toBeGreaterThan(0);
  });
});
