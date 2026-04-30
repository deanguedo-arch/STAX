import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateReleaseGate,
  ReleaseArtifactWriter,
  scoreDoctrineCompliance
} from "../../src/staxcore/index.js";

describe("staxcore release artifact writer", () => {
  it("writes an auditable release artifact", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "staxcore-artifact-"));
    const writer = new ReleaseArtifactWriter(rootDir);
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
    const doctrineCompliance = scoreDoctrineCompliance({
      evidence,
      releaseGate,
      replay: {
        deterministic: true,
        chainValid: true,
        runOutputHashes: ["a"],
        controlOutputHashes: ["a"],
        ledgerHashes: ["h1"],
        chainIssues: []
      },
      redteamFixtureCount: 6,
      goldenFixtureCount: 4
    });

    const result = await writer.write({
      doctrineVersion: "core-v1",
      workspace: "test",
      commandChecks: [
        {
          name: "typecheck",
          command: "npm run typecheck",
          passed: true,
          exitCode: 0,
          durationMs: 10,
          stdoutPreview: "ok",
          stderrPreview: ""
        }
      ],
      evidence,
      replay: {
        deterministic: true,
        chainValid: true,
        runOutputHashes: ["a"],
        controlOutputHashes: ["a"],
        ledgerHashes: ["h1"],
        chainIssues: []
      },
      releaseGate,
      doctrineCompliance
    });

    const fullPath = path.join(rootDir, result.path);
    const content = JSON.parse(await fs.readFile(fullPath, "utf8")) as {
      doctrineVersion: string;
      releaseGate: { canRelease: boolean };
      doctrineCompliance: { score: number };
    };
    expect(content.doctrineVersion).toBe("core-v1");
    expect(content.releaseGate.canRelease).toBe(true);
    expect(content.doctrineCompliance.score).toBe(100);
  });
});
