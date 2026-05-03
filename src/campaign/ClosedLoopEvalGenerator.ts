import fs from "node:fs/promises";
import path from "node:path";
import { routeClosedLoopFailurePatterns } from "./FailurePatternRouter.js";
import type { ClosedLoopCodexLedger, ClosedLoopCodexTask } from "./ClosedLoopCodexCampaign.js";

type FailurePatternFixtureRecord = {
  patternId: string;
  name: string;
  category: string;
  badClaim: string;
  expectedStaxBehavior: string;
  criticalMiss: boolean;
  suggestedEvalType: string;
};

export type ClosedLoopEvalArtifact = {
  name: string;
  mode: "project_control";
  input: string;
  expectedProperties: string[];
  forbiddenPatterns: string[];
  requiredSections: string[];
  critical: boolean;
  tags: string[];
  source: "closed_loop_failure";
};

export type ClosedLoopEvalCandidate = {
  candidateId: string;
  candidateType: "eval";
  sourceTaskId: string;
  sourceFailurePatternIds: string[];
  createdFrom: "closed_loop_campaign";
  synthetic: false;
  approvalState: "candidate";
  requiresApproval: true;
  reason: string;
  artifact: ClosedLoopEvalArtifact;
};

export type ClosedLoopEvalGenerationSummary = {
  campaignId: string;
  requiredCandidates: number;
  generatedCandidates: number;
  coverageValid: boolean;
  candidateIds: string[];
  issues: string[];
};

const REQUIRED_SECTIONS = [
  "## Verdict",
  "## Verified",
  "## Weak / Provisional",
  "## Unverified",
  "## Risk",
  "## One Next Action"
];

function taskNeedsEvalCandidate(task: ClosedLoopCodexTask): boolean {
  return Boolean(task.falseAccept || task.falseBlock || task.finalOutcome === "rejected_fake_complete" || !task.staxInitialPromptUseful);
}

async function loadFailurePatternIndex(rootDir = process.cwd()): Promise<Map<string, FailurePatternFixtureRecord>> {
  const dir = path.join(rootDir, "fixtures", "failure_patterns");
  const files = (await fs.readdir(dir)).filter((entry) => entry.endsWith(".json")).sort();
  const records = new Map<string, FailurePatternFixtureRecord>();
  for (const file of files) {
    const parsed = JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as {
      patterns: FailurePatternFixtureRecord[];
    };
    for (const pattern of parsed.patterns) records.set(pattern.patternId, pattern);
  }
  return records;
}

export async function buildClosedLoopEvalCandidate(
  task: ClosedLoopCodexTask,
  patternIndex?: Map<string, FailurePatternFixtureRecord>
): Promise<ClosedLoopEvalCandidate | null> {
  if (!taskNeedsEvalCandidate(task)) return null;
  const routed = routeClosedLoopFailurePatterns(task);
  if (routed.routedPatterns.length === 0) return null;
  const index = patternIndex ?? (await loadFailurePatternIndex());
  const linkedPatterns = routed.routedPatterns.map((item) => index.get(item.patternId)).filter(Boolean) as FailurePatternFixtureRecord[];
  if (linkedPatterns.length === 0) return null;

  const candidateId = `closed_loop_eval_${task.taskId}`;
  const sourceFailurePatternIds = linkedPatterns.map((pattern) => pattern.patternId);
  const forbiddenPatterns = Array.from(
    new Set([
      ...linkedPatterns.map((pattern) => pattern.badClaim),
      ...(sourceFailurePatternIds.includes("A1") || sourceFailurePatternIds.includes("A4") ? ["tests passed", "complete"] : []),
      ...(sourceFailurePatternIds.includes("G1") ? ["ui fixed", "visual issue resolved"] : [])
    ])
  );
  const expectedProperties = Array.from(
    new Set([
      "bounded_prompt",
      ...(sourceFailurePatternIds.includes("A1") || sourceFailurePatternIds.includes("A4") ? ["fake_complete_flag"] : [])
    ])
  );
  const critical = linkedPatterns.some((pattern) => pattern.criticalMiss);
  const artifact: ClosedLoopEvalArtifact = {
    name: candidateId,
    mode: "project_control",
    input: [
      "Audit this closed-loop STAX project-control failure.",
      `Task ID: ${task.taskId}`,
      `Repo: ${task.repo}`,
      `Objective: ${task.objective}`,
      `Codex report: ${task.codexReport}`,
      `Diff evidence: ${task.diffEvidence}`,
      `Command evidence: ${task.commandEvidence}`,
      `Prior STAX audit: ${task.staxPostCodexAudit}`,
      `Failure patterns to guard: ${linkedPatterns.map((pattern) => `${pattern.patternId} ${pattern.name}`).join("; ")}`,
      "Return one bounded project-control control card and keep any promotion or completion claim blocked until proof is strong."
    ].join("\n"),
    expectedProperties,
    forbiddenPatterns,
    requiredSections: REQUIRED_SECTIONS,
    critical,
    tags: ["closed_loop_failure", task.repo, ...sourceFailurePatternIds],
    source: "closed_loop_failure"
  };

  return {
    candidateId,
    candidateType: "eval",
    sourceTaskId: task.taskId,
    sourceFailurePatternIds,
    createdFrom: "closed_loop_campaign",
    synthetic: false,
    approvalState: "candidate",
    requiresApproval: true,
    reason: `Closed-loop task ${task.taskId} routed to ${sourceFailurePatternIds.join(", ")}.`,
    artifact
  };
}

export async function summarizeClosedLoopEvalGeneration(args: {
  ledger: ClosedLoopCodexLedger;
  patternIndex?: Map<string, FailurePatternFixtureRecord>;
}): Promise<ClosedLoopEvalGenerationSummary> {
  const index = args.patternIndex ?? (await loadFailurePatternIndex());
  const requiredTasks = args.ledger.tasks.filter(taskNeedsEvalCandidate);
  const candidates = await Promise.all(requiredTasks.map((task) => buildClosedLoopEvalCandidate(task, index)));
  const issues: string[] = [];

  candidates.forEach((candidate, index) => {
    const task = requiredTasks[index]!;
    if (!candidate) {
      issues.push(`${task.taskId}: no eval candidate generated`);
      return;
    }
    if (!candidate.requiresApproval || candidate.approvalState !== "candidate") {
      issues.push(`${task.taskId}: eval candidate must stay candidate-only and require approval`);
    }
    if (candidate.sourceTaskId !== task.taskId) {
      issues.push(`${task.taskId}: eval candidate lost source task linkage`);
    }
  });

  return {
    campaignId: args.ledger.campaignId,
    requiredCandidates: requiredTasks.length,
    generatedCandidates: candidates.filter(Boolean).length,
    coverageValid: issues.length === 0,
    candidateIds: candidates.filter(Boolean).map((candidate) => candidate!.candidateId),
    issues
  };
}

export async function writeClosedLoopEvalCandidates(args: {
  ledger: ClosedLoopCodexLedger;
  rootDir?: string;
}): Promise<{
  outputDir: string;
  manifestPath: string;
  summary: ClosedLoopEvalGenerationSummary;
}> {
  const rootDir = args.rootDir ?? process.cwd();
  const patternIndex = await loadFailurePatternIndex(rootDir);
  const summary = await summarizeClosedLoopEvalGeneration({
    ledger: args.ledger,
    patternIndex
  });
  const outputDir = path.join(rootDir, "learning", "closed_loop", "candidates", "eval");
  await fs.mkdir(outputDir, { recursive: true });

  const requiredTasks = args.ledger.tasks.filter(taskNeedsEvalCandidate);
  const candidates = await Promise.all(requiredTasks.map((task) => buildClosedLoopEvalCandidate(task, patternIndex)));
  for (const candidate of candidates) {
    if (!candidate) continue;
    await fs.writeFile(
      path.join(outputDir, `${candidate.candidateId}.json`),
      JSON.stringify(candidate, null, 2),
      "utf8"
    );
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        campaignId: args.ledger.campaignId,
        summary,
        candidateIds: summary.candidateIds
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    outputDir,
    manifestPath,
    summary
  };
}

export async function loadClosedLoopLedger(rootDir = process.cwd(), ledgerPath?: string): Promise<ClosedLoopCodexLedger> {
  const resolved = ledgerPath ?? path.join(rootDir, "fixtures", "real_use", "closed_loop_20_tasks.json");
  return JSON.parse(await fs.readFile(resolved, "utf8")) as ClosedLoopCodexLedger;
}
