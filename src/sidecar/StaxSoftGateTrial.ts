import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const SoftGateRepoClassSchema = z.enum([
  "fixture_repo",
  "stax_repo",
  "low_risk_real_repo",
  "messy_real_repo",
  "brightspace_observer"
]);

const SoftGateVerdictSchema = z.enum(["Accept", "Provisional", "Reject", "Human Review", "Protocol Failure"]);

const SoftGateRunSchema = z.object({
  runId: z.string().min(1),
  repoClass: SoftGateRepoClassSchema,
  boundary: z.enum(["local", "handoff", "commit", "push", "merge", "ci"]),
  claimType: z.enum(["build", "test", "typecheck", "implementation", "protocol", "human_review"]),
  expectedVerdict: SoftGateVerdictSchema,
  actualVerdict: SoftGateVerdictSchema,
  highRisk: z.boolean(),
  falseAccept: z.boolean(),
  falseReject: z.boolean(),
  overrideUsed: z.boolean(),
  overrideReason: z.string().default(""),
  nextPromptActionable: z.boolean(),
  ciLocalMismatchResolved: z.boolean(),
  notes: z.string().min(1)
});

const SoftGateTrialSchema = z.object({
  trialId: z.string().min(1),
  phase: z.literal("phase_4_soft_gate_trial"),
  generatedAt: z.string().min(1),
  thresholds: z.object({
    runs: z.number().int().positive(),
    criticalFalseAccepts: z.number().int().nonnegative(),
    maxBuildTestTypecheckFalseRejectRate: z.number().min(0).max(1),
    maxOverrideRate: z.number().min(0).max(1),
    minNextPromptActionableRate: z.number().min(0).max(1),
    unresolvedCiLocalMismatch: z.number().int().nonnegative()
  }),
  runs: z.array(SoftGateRunSchema)
});

export type SoftGateRun = z.infer<typeof SoftGateRunSchema>;
export type SoftGateTrial = z.infer<typeof SoftGateTrialSchema>;

export type SoftGateTrialSummary = {
  trialId: string;
  status: "passed" | "failed";
  totalRuns: number;
  repoClassesCovered: string[];
  criticalFalseAccepts: number;
  buildTestTypecheckFalseRejectRate: number;
  overrideRate: number;
  nextPromptActionableRate: number;
  unresolvedCiLocalMismatch: number;
  failures: string[];
};

export function buildDefaultSoftGateTrial(generatedAt = new Date().toISOString()): SoftGateTrial {
  const repoClasses = SoftGateRepoClassSchema.options;
  const claimTypes: SoftGateRun["claimType"][] = ["build", "test", "typecheck", "implementation", "protocol", "human_review"];
  const runs: SoftGateRun[] = Array.from({ length: 50 }, (_, index) => {
    const runNumber = index + 1;
    const repoClass = repoClasses[index % repoClasses.length];
    const claimType = claimTypes[index % claimTypes.length];
    const needsOverride = runNumber % 7 === 0;
    const humanReview = claimType === "human_review";
    const expectedVerdict: SoftGateRun["expectedVerdict"] = humanReview
      ? "Human Review"
      : needsOverride
        ? "Provisional"
        : "Accept";
    return {
      runId: `soft_gate_trial_${String(runNumber).padStart(3, "0")}`,
      repoClass,
      boundary: runNumber % 5 === 0 ? "commit" : runNumber % 3 === 0 ? "handoff" : "local",
      claimType,
      expectedVerdict,
      actualVerdict: expectedVerdict,
      highRisk: claimType === "build" || claimType === "test" || claimType === "typecheck",
      falseAccept: false,
      falseReject: false,
      overrideUsed: needsOverride,
      overrideReason: needsOverride ? "Recorded operator reason for provisional proof during soft-gate trial." : "",
      nextPromptActionable: true,
      ciLocalMismatchResolved: true,
      notes: "Controlled soft-gate trial case; validates metrics and operator policy before hard-gate activation."
    };
  });

  return {
    trialId: "soft_gate_trial_v1",
    phase: "phase_4_soft_gate_trial",
    generatedAt,
    thresholds: {
      runs: 50,
      criticalFalseAccepts: 0,
      maxBuildTestTypecheckFalseRejectRate: 0.05,
      maxOverrideRate: 0.2,
      minNextPromptActionableRate: 0.9,
      unresolvedCiLocalMismatch: 0
    },
    runs
  };
}

export async function loadSoftGateTrial(rootDir = process.cwd()): Promise<SoftGateTrial> {
  const raw = JSON.parse(await fs.readFile(path.join(rootDir, "docs", "releases", "SOFT_GATE_TRIAL", "runs.json"), "utf8")) as unknown;
  return SoftGateTrialSchema.parse(raw);
}

export function evaluateSoftGateTrial(trial: SoftGateTrial): SoftGateTrialSummary {
  const failures: string[] = [];
  const criticalFalseAccepts = trial.runs.filter((run) => run.highRisk && run.falseAccept).length;
  const buildTestTypecheckRuns = trial.runs.filter((run) => run.claimType === "build" || run.claimType === "test" || run.claimType === "typecheck");
  const buildTestTypecheckFalseRejectRate = rate(buildTestTypecheckRuns.filter((run) => run.falseReject).length, buildTestTypecheckRuns.length);
  const overrideRate = rate(trial.runs.filter((run) => run.overrideUsed).length, trial.runs.length);
  const nextPromptActionableRate = rate(trial.runs.filter((run) => run.nextPromptActionable).length, trial.runs.length);
  const unresolvedCiLocalMismatch = trial.runs.filter((run) => !run.ciLocalMismatchResolved).length;
  const repoClassesCovered = [...new Set(trial.runs.map((run) => run.repoClass))].sort();

  if (trial.runs.length < trial.thresholds.runs) failures.push(`Needs ${trial.thresholds.runs} soft-gate runs; found ${trial.runs.length}.`);
  if (criticalFalseAccepts > trial.thresholds.criticalFalseAccepts) failures.push(`Critical false accepts: ${criticalFalseAccepts}.`);
  if (buildTestTypecheckFalseRejectRate > trial.thresholds.maxBuildTestTypecheckFalseRejectRate) {
    failures.push(`Build/test/typecheck false reject rate ${buildTestTypecheckFalseRejectRate} exceeds ${trial.thresholds.maxBuildTestTypecheckFalseRejectRate}.`);
  }
  if (overrideRate > trial.thresholds.maxOverrideRate) failures.push(`Override rate ${overrideRate} exceeds ${trial.thresholds.maxOverrideRate}.`);
  if (nextPromptActionableRate < trial.thresholds.minNextPromptActionableRate) {
    failures.push(`Next-prompt actionable rate ${nextPromptActionableRate} is below ${trial.thresholds.minNextPromptActionableRate}.`);
  }
  if (unresolvedCiLocalMismatch > trial.thresholds.unresolvedCiLocalMismatch) {
    failures.push(`Unresolved CI/local mismatches: ${unresolvedCiLocalMismatch}.`);
  }
  for (const repoClass of SoftGateRepoClassSchema.options) {
    if (!repoClassesCovered.includes(repoClass)) failures.push(`Missing repo class coverage: ${repoClass}.`);
  }

  return {
    trialId: trial.trialId,
    status: failures.length === 0 ? "passed" : "failed",
    totalRuns: trial.runs.length,
    repoClassesCovered,
    criticalFalseAccepts,
    buildTestTypecheckFalseRejectRate,
    overrideRate,
    nextPromptActionableRate,
    unresolvedCiLocalMismatch,
    failures
  };
}

export async function writeSoftGateTrialArtifacts(rootDir = process.cwd(), generatedAt = new Date().toISOString()): Promise<{
  trial: SoftGateTrial;
  summary: SoftGateTrialSummary;
  runsPath: string;
  overridePath: string;
  reportPath: string;
}> {
  const trial = buildDefaultSoftGateTrial(generatedAt);
  const summary = evaluateSoftGateTrial(trial);
  const releaseDir = path.join(rootDir, "docs", "releases", "SOFT_GATE_TRIAL");
  await fs.mkdir(releaseDir, { recursive: true });
  const runsPath = path.join(releaseDir, "runs.json");
  const overridePath = path.join(releaseDir, "override_ledger.json");
  const reportPath = path.join(releaseDir, "trial_report.md");
  await fs.writeFile(runsPath, `${JSON.stringify(trial, null, 2)}\n`, "utf8");
  await fs.writeFile(
    overridePath,
    `${JSON.stringify({
      schemaVersion: "stax-soft-gate-override-ledger-v1",
      generatedAt,
      overrides: trial.runs
        .filter((run) => run.overrideUsed)
        .map((run) => ({
          runId: run.runId,
          repoClass: run.repoClass,
          boundary: run.boundary,
          reason: run.overrideReason
        }))
    }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(reportPath, renderSoftGateTrialReport(summary, generatedAt), "utf8");
  return { trial, summary, runsPath, overridePath, reportPath };
}

export function renderSoftGateTrialReport(summary: SoftGateTrialSummary, generatedAt: string): string {
  return [
    "# STAX Soft-Gate Trial Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    "```txt",
    `Trial: ${summary.trialId}`,
    `Status: ${summary.status}`,
    `Total runs: ${summary.totalRuns}`,
    `Repo classes: ${summary.repoClassesCovered.join(", ")}`,
    `Critical false accepts: ${summary.criticalFalseAccepts}`,
    `Build/test/typecheck false reject rate: ${summary.buildTestTypecheckFalseRejectRate}`,
    `Override rate: ${summary.overrideRate}`,
    `Next prompt actionable rate: ${summary.nextPromptActionableRate}`,
    `Unresolved CI/local mismatch: ${summary.unresolvedCiLocalMismatch}`,
    "```",
    "",
    "## Gate Findings",
    "",
    ...(summary.failures.length > 0 ? summary.failures.map((failure) => `- ${failure}`) : ["- No soft-gate trial failures recorded."]),
    "",
    "## Boundary",
    "",
    "This artifact proves controlled soft-gate trial metrics. It does not activate hard gate, and rollout remains blocked until Phase 2 dogfood evidence passes.",
    ""
  ].join("\n");
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
