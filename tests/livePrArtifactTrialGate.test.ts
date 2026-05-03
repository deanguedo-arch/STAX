import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateLivePrArtifactTrialGate } from "../src/campaign/LivePrArtifactTrialGate.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
  tempDirs.length = 0;
});

async function writeGateSummary(args: {
  recordedAt?: string;
  selectedCaseCount: number;
  liveSourceCount: number;
  fallbackSourceCount: number;
  falseAccepts: number;
  falseBlocks: number;
  falseBlockRatePct: number;
  usefulNextActionRate: number;
  ciProofClassificationSurfaceRate: number;
}): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-live-pr-gate-"));
  tempDirs.push(rootDir);
  const summaryPath = path.join(rootDir, "fixtures", "real_use", "live_pr_artifact_trial_latest.json");
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        fixtureSet: "real_pr_artifact_trial_v1",
        recordedAt: args.recordedAt ?? new Date().toISOString(),
        requestedCaseCount: 25,
        status: "passed",
        blockers: [],
        cases: [],
        ...args
      },
      null,
      2
    ),
    "utf8"
  );
  return rootDir;
}

describe("Live PR artifact trial gate", () => {
  it("passes when recorded summary meets thresholds", async () => {
    const rootDir = await writeGateSummary({
      selectedCaseCount: 25,
      liveSourceCount: 25,
      fallbackSourceCount: 0,
      falseAccepts: 0,
      falseBlocks: 0,
      falseBlockRatePct: 0,
      usefulNextActionRate: 100,
      ciProofClassificationSurfaceRate: 100
    });

    const summary = await validateLivePrArtifactTrialGate({ rootDir });
    expect(summary.status).toBe("passed");
    expect(summary.blockers).toEqual([]);
  });

  it("blocks when fallback sources and false accepts are present", async () => {
    const rootDir = await writeGateSummary({
      selectedCaseCount: 25,
      liveSourceCount: 0,
      fallbackSourceCount: 25,
      falseAccepts: 2,
      falseBlocks: 3,
      falseBlockRatePct: 12,
      usefulNextActionRate: 100,
      ciProofClassificationSurfaceRate: 100
    });

    const summary = await validateLivePrArtifactTrialGate({ rootDir });
    expect(summary.status).toBe("failed");
    expect(summary.blockers).toContain("fallback snapshot source used in 25 case(s)");
    expect(summary.blockers).toContain("false accepts were recorded during the live PR trial");
  });

  it("blocks when the recorded artifact is stale", async () => {
    const staleTime = new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString();
    const rootDir = await writeGateSummary({
      recordedAt: staleTime,
      selectedCaseCount: 25,
      liveSourceCount: 25,
      fallbackSourceCount: 0,
      falseAccepts: 0,
      falseBlocks: 0,
      falseBlockRatePct: 0,
      usefulNextActionRate: 100,
      ciProofClassificationSurfaceRate: 100
    });

    const summary = await validateLivePrArtifactTrialGate({ rootDir, maxAgeHours: 72 });
    expect(summary.status).toBe("failed");
    expect(summary.blockers.some((item) => item.includes("artifact is stale"))).toBe(true);
  });
});
