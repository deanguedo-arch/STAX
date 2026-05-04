import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { runLivePrArtifactTrial } from "./LivePrArtifactTrial.js";

const LivePrArtifactTrialSummarySchema = z.object({
  fixtureSet: z.string().min(1),
  recordedAt: z.string().datetime(),
  selectedCaseCount: z.number().int().nonnegative(),
  requestedCaseCount: z.number().int().nonnegative(),
  uniquePullRequestCount: z.number().int().nonnegative(),
  liveSourceCount: z.number().int().nonnegative(),
  fallbackSourceCount: z.number().int().nonnegative(),
  falseAccepts: z.number().int().nonnegative(),
  falseBlocks: z.number().int().nonnegative(),
  falseBlockRatePct: z.number().nonnegative(),
  usefulNextActionRate: z.number().nonnegative(),
  ciProofClassificationSurfaceRate: z.number().nonnegative(),
  status: z.enum(["passed", "failed"]),
  blockers: z.array(z.string()),
  cases: z.array(z.object({ caseId: z.string().min(1) })).optional()
});

export type LivePrArtifactTrialGateSummary = Pick<
  z.infer<typeof LivePrArtifactTrialSummarySchema>,
  | "selectedCaseCount"
  | "uniquePullRequestCount"
  | "liveSourceCount"
  | "fallbackSourceCount"
  | "falseAccepts"
  | "falseBlocks"
  | "falseBlockRatePct"
  | "usefulNextActionRate"
  | "ciProofClassificationSurfaceRate"
  | "status"
  | "blockers"
> & {
  recordedAt: string;
  freshnessHours: number;
  liveSourceRate: number;
};

type LivePrArtifactTrialGateInput = {
  rootDir?: string;
  requestedCaseCount?: number;
  minimumLiveSourceCount?: number;
  allowFallbackSource?: boolean;
  source?: "artifact" | "live";
  artifactPath?: string;
  maxAgeHours?: number;
  minimumLiveSourceRate?: number;
  minimumUniquePullRequestCount?: number;
};

export async function validateLivePrArtifactTrialGate(
  input: LivePrArtifactTrialGateInput = {}
): Promise<LivePrArtifactTrialGateSummary> {
  const rootDir = input.rootDir ?? process.cwd();
  const requestedCaseCount = input.requestedCaseCount ?? 25;
  const minimumLiveSourceCount = input.minimumLiveSourceCount ?? 5;
  const allowFallbackSource = input.allowFallbackSource ?? false;
  const maxAgeHours = input.maxAgeHours ?? 72;
  const minimumLiveSourceRate = input.minimumLiveSourceRate;
  const minimumUniquePullRequestCount = input.minimumUniquePullRequestCount;
  const source = input.source ?? "artifact";

  const summary =
    source === "live"
      ? await runLivePrArtifactTrial({
          rootDir,
          requestedCaseCount,
          minimumLiveSourceCount,
          allowFallbackSource
        })
      : await loadRecordedLivePrArtifactTrialSummary({
          rootDir,
          artifactPath: input.artifactPath
        });

  const blockers = [...summary.blockers];
  const freshnessHours = ageHours(summary.recordedAt);
  const liveSourceRate =
    summary.selectedCaseCount === 0
      ? 0
      : Number(((summary.liveSourceCount / summary.selectedCaseCount) * 100).toFixed(2));
  if (freshnessHours > maxAgeHours) {
    blockers.push(`live PR trial artifact is stale at ${freshnessHours}h (max ${maxAgeHours}h)`);
  }
  if (summary.selectedCaseCount < requestedCaseCount) {
    blockers.push(`live PR trial selected case count is below ${requestedCaseCount}`);
  }
  if (minimumUniquePullRequestCount != null && summary.uniquePullRequestCount < minimumUniquePullRequestCount) {
    blockers.push(
      `unique PR coverage too low: ${summary.uniquePullRequestCount}/${minimumUniquePullRequestCount}`
    );
  }
  if (summary.liveSourceCount < minimumLiveSourceCount) {
    blockers.push(`live-source coverage too low: ${summary.liveSourceCount}/${summary.selectedCaseCount} (minimum ${minimumLiveSourceCount})`);
  }
  if (!allowFallbackSource && summary.fallbackSourceCount > 0) {
    blockers.push(`fallback snapshot source used in ${summary.fallbackSourceCount} case(s)`);
  }
  if (minimumLiveSourceRate != null && liveSourceRate < minimumLiveSourceRate) {
    blockers.push(`live-source rate too low: ${liveSourceRate}% (minimum ${minimumLiveSourceRate}%)`);
  }
  if (summary.falseAccepts > 0) blockers.push("false accepts were recorded during the live PR trial");
  if (summary.falseBlockRatePct > 15) blockers.push("false-block rate exceeded 15 percent");
  if (summary.usefulNextActionRate < 85) blockers.push("useful next-action rate fell below 85 percent");
  if (summary.ciProofClassificationSurfaceRate < 90) blockers.push("CI proof classification surfaced below 90 percent");
  const normalizedStatus: "passed" | "failed" = blockers.length === 0 ? "passed" : "failed";

  return {
    selectedCaseCount: summary.selectedCaseCount,
    uniquePullRequestCount: summary.uniquePullRequestCount,
    liveSourceCount: summary.liveSourceCount,
    fallbackSourceCount: summary.fallbackSourceCount,
    falseAccepts: summary.falseAccepts,
    falseBlocks: summary.falseBlocks,
    falseBlockRatePct: summary.falseBlockRatePct,
    usefulNextActionRate: summary.usefulNextActionRate,
    ciProofClassificationSurfaceRate: summary.ciProofClassificationSurfaceRate,
    recordedAt: summary.recordedAt,
    freshnessHours,
    liveSourceRate,
    status: normalizedStatus,
    blockers
  };
}

async function loadRecordedLivePrArtifactTrialSummary(input: {
  rootDir: string;
  artifactPath?: string;
}): Promise<z.infer<typeof LivePrArtifactTrialSummarySchema>> {
  const artifactPath =
    input.artifactPath ??
    path.join(input.rootDir, "fixtures", "real_use", "live_pr_artifact_trial_latest.json");
  const raw = await fs.readFile(artifactPath, "utf8");
  return LivePrArtifactTrialSummarySchema.parse(JSON.parse(raw));
}

function ageHours(isoTime: string): number {
  const nowMs = Date.now();
  const thenMs = new Date(isoTime).getTime();
  if (Number.isNaN(thenMs) || thenMs > nowMs) return 0;
  return Number((((nowMs - thenMs) / (1000 * 60 * 60))).toFixed(2));
}
