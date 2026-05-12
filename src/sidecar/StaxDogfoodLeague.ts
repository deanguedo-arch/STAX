import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const DogfoodVerdictSchema = z.enum(["Accept", "Provisional", "Reject", "Human Review", "Protocol Failure"]);
const HumanVerdictSchema = z.enum(["accepted", "accepted_after_fix", "rejected", "needs_more_proof", "not_reviewed"]);
const DogfoodModeSchema = z.enum(["observer", "bootstrap_observation"]);

const DogfoodRunSchema = z.object({
  taskId: z.string().min(1),
  mode: DogfoodModeSchema,
  countsTowardExitGate: z.boolean(),
  repo: z.string().min(1),
  task: z.string().min(1),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1).optional(),
  claimTypes: z.array(z.string().min(1)).min(1),
  codexReportSummary: z.string().min(1),
  staxVerdict: DogfoodVerdictSchema,
  humanVerdict: HumanVerdictSchema,
  falseAccept: z.boolean(),
  falseReject: z.boolean(),
  criticalFalseAccept: z.boolean().default(false),
  protocolCompliant: z.boolean(),
  bypassUsed: z.boolean(),
  bypassReason: z.string().default(""),
  nextPromptUsableWithoutRewrite: z.boolean(),
  timeCostMinutes: z.number().min(0),
  workflowBurdenFindings: z.array(z.string().min(1)).default([]),
  debloatFindings: z.array(z.string().min(1)).default([]),
  missesConvertedToTests: z.array(z.string().min(1)).default([]),
  notes: z.string().min(1)
});

const DogfoodLeagueSchema = z.object({
  leagueId: z.string().min(1),
  phase: z.literal("phase_2_stax_self_dogfood"),
  status: z.enum(["in_progress", "passed", "failed"]),
  thresholds: z.object({
    eligibleRuns: z.number().int().positive(),
    criticalFalseAccepts: z.number().int().nonnegative(),
    maxFalseRejectRate: z.number().min(0).max(1),
    minProtocolComplianceRate: z.number().min(0).max(1),
    minNextPromptActionableRate: z.number().min(0).max(1)
  }),
  runs: z.array(DogfoodRunSchema)
});

export type DogfoodRun = z.infer<typeof DogfoodRunSchema>;
export type DogfoodLeague = z.infer<typeof DogfoodLeagueSchema>;

export type DogfoodLeagueSummary = {
  leagueId: string;
  status: "in_progress" | "passed" | "failed";
  totalRuns: number;
  eligibleRuns: number;
  bootstrapObservations: number;
  criticalFalseAccepts: number;
  falseRejects: number;
  falseRejectRate: number;
  protocolComplianceRate: number;
  nextPromptActionableRate: number;
  bypassRate: number;
  repeatedFailureClasses: string[];
  promotionGatePassed: boolean;
  failures: string[];
};

export async function loadDogfoodLeague(rootDir = process.cwd()): Promise<DogfoodLeague> {
  const ledgerPath = path.join(rootDir, "docs", "releases", "STAX_DOGFOOD_LEAGUE", "observer_runs.json");
  const raw = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as unknown;
  return DogfoodLeagueSchema.parse(raw);
}

export function evaluateDogfoodLeague(league: DogfoodLeague): DogfoodLeagueSummary {
  const eligible = league.runs.filter((run) => run.countsTowardExitGate && run.mode === "observer");
  const bootstrapObservations = league.runs.filter((run) => run.mode === "bootstrap_observation").length;
  const criticalFalseAccepts = eligible.filter((run) => run.criticalFalseAccept || run.falseAccept).length;
  const falseRejects = eligible.filter((run) => run.falseReject).length;
  const falseRejectRate = rate(falseRejects, eligible.length);
  const protocolComplianceRate = rate(eligible.filter((run) => run.protocolCompliant).length, eligible.length);
  const nextPromptActionableRate = rate(eligible.filter((run) => run.nextPromptUsableWithoutRewrite).length, eligible.length);
  const bypassRate = rate(eligible.filter((run) => run.bypassUsed).length, eligible.length);
  const repeatedFailureClasses = repeatedWorkflowFailures(eligible);
  const failures: string[] = [];

  if (eligible.length < league.thresholds.eligibleRuns) {
    failures.push(`Needs ${league.thresholds.eligibleRuns} eligible observer runs; currently has ${eligible.length}.`);
  }
  if (criticalFalseAccepts > league.thresholds.criticalFalseAccepts) {
    failures.push(`Critical false accepts: ${criticalFalseAccepts}.`);
  }
  if (falseRejectRate > league.thresholds.maxFalseRejectRate) {
    failures.push(`False reject rate ${falseRejectRate} exceeds ${league.thresholds.maxFalseRejectRate}.`);
  }
  if (eligible.length > 0 && protocolComplianceRate < league.thresholds.minProtocolComplianceRate) {
    failures.push(`Protocol compliance rate ${protocolComplianceRate} is below ${league.thresholds.minProtocolComplianceRate}.`);
  }
  if (eligible.length > 0 && nextPromptActionableRate < league.thresholds.minNextPromptActionableRate) {
    failures.push(`Next-prompt actionable rate ${nextPromptActionableRate} is below ${league.thresholds.minNextPromptActionableRate}.`);
  }
  if (repeatedFailureClasses.length > 0) {
    failures.push(`Repeated failure classes need regression tests: ${repeatedFailureClasses.join(", ")}.`);
  }

  return {
    leagueId: league.leagueId,
    status: failures.length === 0 ? "passed" : eligible.length === 0 ? "in_progress" : "failed",
    totalRuns: league.runs.length,
    eligibleRuns: eligible.length,
    bootstrapObservations,
    criticalFalseAccepts,
    falseRejects,
    falseRejectRate,
    protocolComplianceRate,
    nextPromptActionableRate,
    bypassRate,
    repeatedFailureClasses,
    promotionGatePassed: failures.length === 0,
    failures
  };
}

export function renderDogfoodObserverReport(league: DogfoodLeague, generatedAt: string): string {
  const summary = evaluateDogfoodLeague(league);
  const runLines = league.runs.length === 0
    ? ["No dogfood runs recorded yet."]
    : league.runs.map((run) => `- ${run.taskId}: ${run.mode}, ${run.staxVerdict}, human=${run.humanVerdict}, counts=${run.countsTowardExitGate}`);
  const debloatFindings = league.runs.flatMap((run) => run.debloatFindings);
  const burdenFindings = league.runs.flatMap((run) => run.workflowBurdenFindings);

  return [
    "# STAX Dogfood Observer Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    "```txt",
    `League: ${summary.leagueId}`,
    `Status: ${summary.status}`,
    `Total runs: ${summary.totalRuns}`,
    `Eligible observer runs: ${summary.eligibleRuns}`,
    `Bootstrap observations: ${summary.bootstrapObservations}`,
    `Critical false accepts: ${summary.criticalFalseAccepts}`,
    `False rejects: ${summary.falseRejects}`,
    `False reject rate: ${summary.falseRejectRate}`,
    `Protocol compliance rate: ${summary.protocolComplianceRate}`,
    `Next prompt actionable rate: ${summary.nextPromptActionableRate}`,
    `Bypass rate: ${summary.bypassRate}`,
    `Promotion gate passed: ${summary.promotionGatePassed}`,
    "```",
    "",
    "## Gate Findings",
    "",
    ...(summary.failures.length > 0 ? summary.failures.map((failure) => `- ${failure}`) : ["- Phase 2 promotion gate passed."]),
    "",
    "## Runs",
    "",
    ...runLines,
    "",
    "## Workflow Burden Findings",
    "",
    ...(burdenFindings.length > 0 ? burdenFindings.map((item) => `- ${item}`) : ["- No workflow burden findings recorded yet."]),
    "",
    "## Debloat Findings",
    "",
    ...(debloatFindings.length > 0 ? debloatFindings.map((item) => `- ${item}`) : ["- No debloat findings recorded yet."]),
    ""
  ].join("\n");
}

export function renderDogfoodRegressionAdditions(league: DogfoodLeague, generatedAt: string): string {
  const additions = league.runs.flatMap((run) => run.missesConvertedToTests.map((item) => ({ taskId: run.taskId, item })));
  return [
    "# STAX Dogfood Regression Additions",
    "",
    `Generated: ${generatedAt}`,
    "",
    ...(additions.length > 0
      ? additions.map((entry) => `- ${entry.taskId}: ${entry.item}`)
      : ["No repeated Phase 2 misses have been converted into regression tests yet."]),
    ""
  ].join("\n");
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function repeatedWorkflowFailures(runs: DogfoodRun[]): string[] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    for (const finding of [...run.workflowBurdenFindings, ...run.debloatFindings]) {
      counts.set(finding, (counts.get(finding) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([finding]) => finding)
    .sort();
}
