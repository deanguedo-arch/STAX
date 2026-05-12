import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { evaluateDogfoodLeague, loadDogfoodLeague } from "./StaxDogfoodLeague.js";
import { evaluateSoftGateTrial, loadSoftGateTrial } from "./StaxSoftGateTrial.js";

export type RolloutPhaseId =
  | "phase_0_baseline"
  | "phase_1_fixture_league"
  | "phase_2_dogfood_league"
  | "phase_3_claim_extraction"
  | "phase_4_soft_gate_trial"
  | "phase_5_product_surface"
  | "phase_6_limited_hard_gate";

export type RolloutPhaseStatus = "passed" | "in_progress" | "blocked" | "failed";

export type RolloutPhaseGateItem = {
  phase: RolloutPhaseId;
  title: string;
  status: RolloutPhaseStatus;
  scoreTarget: string;
  promotionGatePassed: boolean;
  failures: string[];
  proofArtifacts: string[];
  nextAction: string;
};

export type RolloutPhaseGateReport = {
  schemaVersion: "stax-rollout-phase-gate-v1";
  generatedAt: string;
  status: RolloutPhaseStatus;
  phases: RolloutPhaseGateItem[];
  nextAction: string;
};

const Phase1ResultsSchema = z.object({
  expandedCases: z.number(),
  criticalFalseAccepts: z.number(),
  falseRejectRate: z.number(),
  nextPromptActionableRate: z.number(),
  passed: z.boolean()
});

const Phase3ResultsSchema = z.object({
  totalCases: z.number(),
  highRiskFalseNegatives: z.number(),
  falsePositiveRate: z.number(),
  unsupportedClaimAccepts: z.number(),
  passed: z.boolean()
});

export async function evaluateRolloutPhaseGate(rootDir = process.cwd(), generatedAt = new Date().toISOString()): Promise<RolloutPhaseGateReport> {
  const phases: RolloutPhaseGateItem[] = [
    await evaluatePhase0(rootDir),
    await evaluatePhase1(rootDir),
    await evaluatePhase2(rootDir),
    await evaluatePhase3(rootDir)
  ];
  phases.push(await evaluatePhase4(rootDir, phases));
  phases.push(await evaluatePhase5(rootDir, phases));
  phases.push(await evaluatePhase6(rootDir, phases));

  const status = overallStatus(phases);
  return {
    schemaVersion: "stax-rollout-phase-gate-v1",
    generatedAt,
    status,
    phases,
    nextAction: nextActionFor(phases)
  };
}

export async function writeRolloutPhaseGateArtifacts(rootDir = process.cwd(), generatedAt = new Date().toISOString()): Promise<{
  report: RolloutPhaseGateReport;
  statusPath: string;
  markdownPath: string;
}> {
  const report = await evaluateRolloutPhaseGate(rootDir, generatedAt);
  const releaseDir = path.join(rootDir, "docs", "releases", "ROLLOUT_PHASE_GATE");
  await fs.mkdir(releaseDir, { recursive: true });
  const statusPath = path.join(releaseDir, "status.json");
  const markdownPath = path.join(releaseDir, "report.md");
  await fs.writeFile(statusPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, renderRolloutPhaseGateReport(report), "utf8");
  return { report, statusPath, markdownPath };
}

export function renderRolloutPhaseGateReport(report: RolloutPhaseGateReport): string {
  const lines = [
    "# STAX Rollout Phase Gate",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    "```txt",
    `Status: ${report.status}`,
    `Next action: ${report.nextAction}`,
    "```",
    "",
    "## Phase Status",
    ""
  ];

  for (const phase of report.phases) {
    lines.push(
      `### ${phase.title}`,
      "",
      "```txt",
      `Phase: ${phase.phase}`,
      `Status: ${phase.status}`,
      `Score target: ${phase.scoreTarget}`,
      `Promotion gate passed: ${phase.promotionGatePassed}`,
      "```",
      "",
      "Proof artifacts:",
      "",
      ...phase.proofArtifacts.map((artifact) => `- ${artifact}`),
      "",
      "Gate findings:",
      "",
      ...(phase.failures.length > 0 ? phase.failures.map((failure) => `- ${failure}`) : ["- No gate failures recorded."]),
      "",
      `Next action: ${phase.nextAction}`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

async function evaluatePhase0(rootDir: string): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "docs/releases/STAX_RC_CURRENT/command_proof.md",
    "docs/releases/STAX_RC_CURRENT/known_limits.md",
    "docs/releases/STAX_RC_CURRENT/allowed_claims.md",
    "docs/releases/STAX_RC_CURRENT/forbidden_claims.md"
  ];
  const failures: string[] = [];
  for (const artifact of artifacts) {
    if (!(await exists(path.join(rootDir, artifact)))) failures.push(`Missing proof artifact: ${artifact}.`);
  }
  const commandProof = await readIfExists(path.join(rootDir, artifacts[0]));
  if (!/Status:\s*Pass/.test(commandProof)) failures.push("Phase 0 command proof does not record Status: Pass.");
  if (!/npm ci/.test(commandProof) || !/npm run typecheck/.test(commandProof) || !/npm test/.test(commandProof)) {
    failures.push("Phase 0 command proof does not list the required baseline commands.");
  }
  return phaseItem({
    phase: "phase_0_baseline",
    title: "Phase 0 - Lock Current Proof Baseline",
    scoreTarget: "Baseline validation commands pass and known limits are explicit.",
    artifacts,
    failures,
    nextAction: failures.length === 0 ? "Keep this baseline immutable unless a new baseline proof packet is generated." : "Regenerate the Phase 0 proof packet."
  });
}

async function evaluatePhase1(rootDir: string): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "fixtures/stax_trials/manifest.json",
    "fixtures/stax_trials/results.json",
    "fixtures/stax_trials/failure_report.md"
  ];
  const failures: string[] = [];
  for (const artifact of artifacts) {
    if (!(await exists(path.join(rootDir, artifact)))) failures.push(`Missing proof artifact: ${artifact}.`);
  }
  const parsed = await parseJson(path.join(rootDir, "fixtures", "stax_trials", "results.json"), Phase1ResultsSchema);
  if (!parsed) {
    failures.push("Phase 1 results artifact is missing or malformed.");
  } else {
    if (!parsed.passed) failures.push("Phase 1 results artifact is not passing.");
    if (parsed.expandedCases < 50) failures.push(`Phase 1 needs at least 50 expanded cases; found ${parsed.expandedCases}.`);
    if (parsed.criticalFalseAccepts !== 0) failures.push(`Phase 1 critical false accepts: ${parsed.criticalFalseAccepts}.`);
    if (parsed.falseRejectRate > 0.05) failures.push(`Phase 1 false reject rate ${parsed.falseRejectRate} exceeds 0.05.`);
    if (parsed.nextPromptActionableRate < 0.9) failures.push(`Phase 1 next-prompt actionable rate ${parsed.nextPromptActionableRate} is below 0.9.`);
  }
  return phaseItem({
    phase: "phase_1_fixture_league",
    title: "Phase 1 - Adversarial Fixture League",
    scoreTarget: "50 fixtures, 0 critical false accepts, <=5% false rejects, >=90% actionable next prompts.",
    artifacts,
    failures,
    nextAction: failures.length === 0 ? "Keep fixture failures converted into regression cases before broad rollout." : "Fix the fixture league before adding broader rollout evidence."
  });
}

async function evaluatePhase2(rootDir: string): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "docs/releases/STAX_DOGFOOD_LEAGUE/observer_runs.json",
    "docs/releases/STAX_DOGFOOD_LEAGUE/observer_report.md",
    "docs/releases/STAX_DOGFOOD_LEAGUE/regression_additions.md"
  ];
  const failures: string[] = [];
  for (const artifact of artifacts) {
    if (!(await exists(path.join(rootDir, artifact)))) failures.push(`Missing proof artifact: ${artifact}.`);
  }
  try {
    const league = await loadDogfoodLeague(rootDir);
    const summary = evaluateDogfoodLeague(league);
    failures.push(...summary.failures);
  } catch (error) {
    failures.push(`Phase 2 dogfood ledger is missing or malformed: ${error instanceof Error ? error.message : String(error)}.`);
  }
  return phaseItem({
    phase: "phase_2_dogfood_league",
    title: "Phase 2 - STAX Self-Dogfood League",
    scoreTarget: "20 eligible observer runs, 0 critical false accepts, <=10% false rejects, >=90% protocol and next-prompt rates.",
    artifacts,
    failures,
    missingCountOnlyIsProgress: true,
    nextAction: failures.length === 0 ? "Proceed to measured soft-gate trial only after misses are in regression tests." : "Continue real observer runs and convert repeated misses into tests."
  });
}

async function evaluatePhase3(rootDir: string): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "fixtures/stax_trials/claim_evasion_results.json",
    "docs/releases/CLAIM_EXTRACTION_HARDENING/report.md",
    "docs/releases/CLAIM_EXTRACTION_HARDENING/allowed_phrasing.md"
  ];
  const failures: string[] = [];
  for (const artifact of artifacts) {
    if (!(await exists(path.join(rootDir, artifact)))) failures.push(`Missing proof artifact: ${artifact}.`);
  }
  const parsed = await parseJson(path.join(rootDir, "fixtures", "stax_trials", "claim_evasion_results.json"), Phase3ResultsSchema);
  if (!parsed) {
    failures.push("Phase 3 results artifact is missing or malformed.");
  } else {
    if (!parsed.passed) failures.push("Phase 3 results artifact is not passing.");
    if (parsed.totalCases < 100) failures.push(`Phase 3 needs at least 100 cases; found ${parsed.totalCases}.`);
    if (parsed.highRiskFalseNegatives !== 0) failures.push(`Phase 3 high-risk false negatives: ${parsed.highRiskFalseNegatives}.`);
    if (parsed.falsePositiveRate > 0.1) failures.push(`Phase 3 false positive rate ${parsed.falsePositiveRate} exceeds 0.1.`);
    if (parsed.unsupportedClaimAccepts !== 0) failures.push(`Phase 3 unsupported claim accepts: ${parsed.unsupportedClaimAccepts}.`);
  }
  return phaseItem({
    phase: "phase_3_claim_extraction",
    title: "Phase 3 - Claim Extraction Hardening",
    scoreTarget: "100 claim-evasion fixtures, 0 high-risk false negatives, <=10% false positives, 0 unsupported accepts.",
    artifacts,
    failures,
    nextAction: failures.length === 0 ? "Use Phase 3 as a prerequisite for soft-gate trials." : "Harden claim extraction before soft-gate rollout."
  });
}

async function evaluatePhase4(rootDir: string, phases: RolloutPhaseGateItem[]): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "docs/releases/SOFT_GATE_TRIAL/runs.json",
    "docs/releases/SOFT_GATE_TRIAL/override_ledger.json",
    "docs/releases/SOFT_GATE_TRIAL/trial_report.md"
  ];
  const failures = await missingArtifacts(rootDir, artifacts);
  if (failures.length === 0) {
    try {
      const summary = evaluateSoftGateTrial(await loadSoftGateTrial(rootDir));
      failures.push(...summary.failures);
      if (summary.status !== "passed") failures.push("Soft-gate trial summary is not passing.");
    } catch (error) {
      failures.push(`Soft-gate trial artifact is missing or malformed: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
  const prerequisiteFailures = prerequisitesNotPassed(phases, ["phase_2_dogfood_league", "phase_3_claim_extraction"]);
  failures.push(...prerequisiteFailures);
  return phaseItem({
    phase: "phase_4_soft_gate_trial",
    title: "Phase 4 - Soft-Gate Trial",
    scoreTarget: "50 soft-gate runs, 0 high-risk false accepts, <=5% false rejects for build/test/typecheck, <=20% overrides.",
    artifacts,
    failures,
    blockedByPrerequisite: prerequisiteFailures.length > 0,
    nextAction: "Finish the dogfood league, then run measured soft-gate trials with an override ledger."
  });
}

async function evaluatePhase5(rootDir: string, phases: RolloutPhaseGateItem[]): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "docs/releases/PRODUCT_SURFACE_AMPUTATION/demo_checklist.md",
    "docs/releases/PRODUCT_SURFACE_AMPUTATION/public_surface_map.md",
    "docs/releases/PRODUCT_SURFACE_AMPUTATION/archive_map.md"
  ];
  const failures = await missingArtifacts(rootDir, artifacts);
  const publicCommands = await publicSurfaceCommands(rootDir);
  if (publicCommands.length === 0) {
    failures.push("Public surface map does not list the public STAX commands.");
  } else if (publicCommands.length > 6) {
    failures.push(`Public STAX command surface has ${publicCommands.length} entries; target is <= 6: ${publicCommands.join(", ")}.`);
  }
  const demoChecklist = await readIfExists(path.join(rootDir, "docs", "releases", "PRODUCT_SURFACE_AMPUTATION", "demo_checklist.md"));
  if (!/Status:\s*passed/i.test(demoChecklist)) {
    failures.push("Product-surface demo checklist is not marked Status: passed.");
  }
  const prerequisiteFailures = prerequisitesNotPassed(phases, ["phase_4_soft_gate_trial"]);
  failures.push(...prerequisiteFailures);
  return phaseItem({
    phase: "phase_5_product_surface",
    title: "Phase 5 - Product Surface Amputation",
    scoreTarget: "Public surface <=6 commands and cold-user demo/docs prove the narrowed product story.",
    artifacts,
    failures,
    blockedByPrerequisite: prerequisiteFailures.length > 0,
    nextAction: "Map public/internal/archive commands, then shrink the visible product path without deleting internal capability."
  });
}

async function evaluatePhase6(rootDir: string, phases: RolloutPhaseGateItem[]): Promise<RolloutPhaseGateItem> {
  const artifacts = [
    "docs/releases/LIMITED_HARD_GATE/boundary_policy.md",
    "docs/releases/LIMITED_HARD_GATE/override_policy.md",
    "docs/releases/LIMITED_HARD_GATE/rollback_proof.md",
    "docs/releases/LIMITED_HARD_GATE/trial_report.md"
  ];
  const failures = await missingArtifacts(rootDir, artifacts);
  const trialReport = await readIfExists(path.join(rootDir, "docs", "releases", "LIMITED_HARD_GATE", "trial_report.md"));
  if (!/Status:\s*passed/i.test(trialReport)) {
    failures.push("Limited hard-gate trial report is not marked Status: passed.");
  }
  const prerequisiteFailures = prerequisitesNotPassed(phases, ["phase_4_soft_gate_trial"]);
  failures.push(...prerequisiteFailures);
  return phaseItem({
    phase: "phase_6_limited_hard_gate",
    title: "Phase 6 - Limited Hard Gate",
    scoreTarget: "Hard gate only protected boundaries after 50+ soft-gate runs across 3+ repos.",
    artifacts,
    failures,
    blockedByPrerequisite: prerequisiteFailures.length > 0,
    nextAction: "Do not turn on hard gate until soft-gate trial evidence and boundary policies pass."
  });
}

function phaseItem(input: {
  phase: RolloutPhaseId;
  title: string;
  scoreTarget: string;
  artifacts: string[];
  failures: string[];
  nextAction: string;
  missingCountOnlyIsProgress?: boolean;
  blockedByPrerequisite?: boolean;
}): RolloutPhaseGateItem {
  const status: RolloutPhaseStatus = input.failures.length === 0
    ? "passed"
    : input.blockedByPrerequisite
      ? "blocked"
      : input.missingCountOnlyIsProgress && input.failures.every((failure) => /^Needs \d+ eligible observer runs/.test(failure))
        ? "in_progress"
        : "failed";
  return {
    phase: input.phase,
    title: input.title,
    status,
    scoreTarget: input.scoreTarget,
    promotionGatePassed: status === "passed",
    failures: input.failures,
    proofArtifacts: input.artifacts,
    nextAction: input.nextAction
  };
}

function overallStatus(phases: RolloutPhaseGateItem[]): RolloutPhaseStatus {
  if (phases.some((phase) => phase.status === "failed")) return "failed";
  if (phases.some((phase) => phase.status === "blocked")) return "blocked";
  if (phases.some((phase) => phase.status === "in_progress")) return "in_progress";
  return "passed";
}

function nextActionFor(phases: RolloutPhaseGateItem[]): string {
  const next = phases.find((phase) => phase.status !== "passed");
  return next?.nextAction ?? "All rollout phases have passed their deterministic gates.";
}

function prerequisitesNotPassed(phases: RolloutPhaseGateItem[], ids: RolloutPhaseId[]): string[] {
  return ids.flatMap((id) => {
    const phase = phases.find((item) => item.phase === id);
    return phase?.status === "passed" ? [] : [`Prerequisite ${id} is not passed.`];
  });
}

async function missingArtifacts(rootDir: string, artifacts: string[]): Promise<string[]> {
  const failures: string[] = [];
  for (const artifact of artifacts) {
    if (!(await exists(path.join(rootDir, artifact)))) failures.push(`Missing proof artifact: ${artifact}.`);
  }
  return failures;
}

async function publicSurfaceCommands(rootDir: string): Promise<string[]> {
  const publicMap = await readIfExists(path.join(rootDir, "docs", "releases", "PRODUCT_SURFACE_AMPUTATION", "public_surface_map.md"));
  const commands = new Set<string>();
  for (const match of publicMap.matchAll(/^- `([^`]+)`/gm)) {
    const command = match[1]?.trim();
    if (command?.startsWith("stax ")) commands.add(command);
  }
  return [...commands].sort();
}

async function parseJson<T>(filePath: string, schema: z.ZodType<T>): Promise<T | undefined> {
  try {
    return schema.parse(JSON.parse(await fs.readFile(filePath, "utf8")) as unknown);
  } catch {
    return undefined;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
