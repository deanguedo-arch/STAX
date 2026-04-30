import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ReleaseArtifactStore } from "../../src/staxcore/index.js";

describe("staxcore release artifact store", () => {
  it("loads recent artifacts sorted by createdAt desc", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "staxcore-store-"));
    const baseDir = path.join(rootDir, "runs", "staxcore_release", "2026-04-30");
    await fs.mkdir(baseDir, { recursive: true });

    const older = {
      artifactId: "older",
      createdAt: "2026-04-30T01:00:00.000Z",
      doctrineVersion: "core-v1",
      commandChecks: [],
      evidence: {
        typecheckPassed: true,
        testsPassed: true,
        doctrineAuditPassed: true,
        boundaryAuditPassed: true,
        securityAuditPassed: true,
        replayPassed: true
      },
      replay: {
        deterministic: true,
        chainValid: true,
        runOutputHashes: [],
        controlOutputHashes: [],
        ledgerHashes: [],
        chainIssues: []
      },
      releaseGate: {
        canRelease: true,
        profile: "standard",
        requiredChecks: {},
        failedChecks: [],
        summary: "ok"
      },
      doctrineCompliance: {
        score: 90,
        grade: "A",
        breakdown: {},
        notes: []
      }
    };
    const newer = { ...older, artifactId: "newer", createdAt: "2026-04-30T02:00:00.000Z" };

    await fs.writeFile(path.join(baseDir, "older.json"), JSON.stringify(older, null, 2), "utf8");
    await fs.writeFile(path.join(baseDir, "newer.json"), JSON.stringify(newer, null, 2), "utf8");

    const store = new ReleaseArtifactStore(rootDir);
    const recent = await store.listRecent(2);

    expect(recent).toHaveLength(2);
    expect(recent[0]?.artifact.artifactId).toBe("newer");
    expect(recent[1]?.artifact.artifactId).toBe("older");
  });
});
