import fs from "node:fs/promises";
import path from "node:path";
import { classifyCiLogEvidence } from "../evidence/CiLogIntelligence.js";
import type { CommandProofStrength } from "../evidence/CommandEvidenceIntelligenceSchemas.js";
import type { CiLogIntelligenceInput } from "../evidence/CiLogIntelligenceSchemas.js";

export type CiFailureLikelyCause =
  | "wrong_commit"
  | "wrong_branch"
  | "stale_run"
  | "test_failure"
  | "build_failure"
  | "lint_failure"
  | "cancelled_run"
  | "skipped_run"
  | "partial_matrix"
  | "environment_blocker"
  | "release_gate_missing"
  | "unknown";

export type CiFailureTriageInput = CiLogIntelligenceInput & {
  repo?: string;
  diffSummary?: string;
  priorFailures?: string[];
};

export type CiFailureTriageResult = {
  likelyCause: CiFailureLikelyCause;
  proofStrength: CommandProofStrength;
  proof: string[];
  risk: string[];
  nextAction: string;
  codexPrompt: string;
};

export type CiFailureFixtureCase = CiFailureTriageInput & {
  caseId: string;
  description: string;
  expectedLikelyCause: CiFailureLikelyCause;
  expectedProofStrength: CommandProofStrength;
  expectedNextActionContains: string;
};

export function triageCiFailure(input: CiFailureTriageInput): CiFailureTriageResult {
  const insight = classifyCiLogEvidence(input);
  const joined = [input.summary ?? "", input.log ?? "", input.diffSummary ?? ""].join("\n").toLowerCase();
  const proof: string[] = [];
  const risk: string[] = [...insight.limitations.map((item) => item), ...insight.warnings.map((item) => item)];

  let likelyCause: CiFailureLikelyCause = "unknown";
  if (insight.flags.includes("wrong_commit")) likelyCause = "wrong_commit";
  else if (insight.flags.includes("wrong_branch")) likelyCause = "wrong_branch";
  else if (insight.flags.includes("stale_run")) likelyCause = "stale_run";
  else if (insight.flags.includes("job_cancelled")) likelyCause = "cancelled_run";
  else if (insight.flags.includes("job_skipped")) likelyCause = "skipped_run";
  else if (insight.matrixState === "partial") likelyCause = "partial_matrix";
  else if (/\bpytest|jest|vitest|rspec|phpunit|go test|cargo test|failing test|assert/i.test(joined)) likelyCause = "test_failure";
  else if (/\beslint|lint\b/i.test(joined)) likelyCause = "lint_failure";
  else if (/\bbuild\b|\btsc\b|\bvite\b|\bcompile\b/i.test(joined)) likelyCause = "build_failure";
  else if (/\bpermission denied|missing dependency|module not found|command not found|no such file or directory|toolchain|binary missing|browser not found\b/i.test(joined)) likelyCause = "environment_blocker";
  else if (/\brollback|revert|release|deploy|publish\b/i.test(joined)) likelyCause = "release_gate_missing";

  if (input.workflow) proof.push(`Workflow: ${input.workflow}`);
  if (input.jobName) proof.push(`Job: ${input.jobName}`);
  if (input.branch) proof.push(`Branch: ${input.branch}`);
  if (input.commitSha) proof.push(`Commit: ${input.commitSha}`);
  if (input.runUrl) proof.push(`Run URL: ${input.runUrl}`);

  const nextAction = nextActionForCause({ likelyCause, input, insight: insight.proofStrength });
  const codexPrompt = codexPromptForCause({ likelyCause, input });

  return {
    likelyCause,
    proofStrength: insight.proofStrength,
    proof,
    risk: dedupe(risk),
    nextAction,
    codexPrompt
  };
}

export async function loadCiFailureFixtureCases(rootDir = process.cwd()): Promise<CiFailureFixtureCase[]> {
  const raw = JSON.parse(
    await fs.readFile(path.join(rootDir, "fixtures", "ci_failure_triage", "ci_failure_triage_24_cases.json"), "utf8")
  ) as { cases: CiFailureFixtureCase[] };
  return raw.cases;
}

function nextActionForCause(args: {
  likelyCause: CiFailureLikelyCause;
  input: CiFailureTriageInput;
  insight: CommandProofStrength;
}): string {
  switch (args.likelyCause) {
    case "wrong_commit":
      return "Rerun the relevant workflow on the PR head commit and return the updated job output before treating CI as proof.";
    case "wrong_branch":
      return "Rerun the workflow on the correct branch or attach the run from the expected branch before treating CI as proof.";
    case "stale_run":
      return "Use a newer workflow run that finished after the current diff/commit and return the updated CI evidence.";
    case "cancelled_run":
      return "Restart the cancelled job or workflow and return the first failing step if it still does not complete.";
    case "skipped_run":
      return "Run the skipped job or explain why it is intentionally out of scope before asking for approval.";
    case "partial_matrix":
      return "Complete the missing matrix jobs and return the first failing leg instead of treating a partial matrix as passing proof.";
    case "test_failure":
      return "Inspect the first failing test name and rerun only the smallest relevant local test command before changing broader scope.";
    case "lint_failure":
      return "Fix the first lint failure or prove it is unrelated, then rerun the bounded lint command.";
    case "build_failure":
      return "Inspect the first failing build step locally and rerun only the bounded build command from the target repo root.";
    case "environment_blocker":
      return "Resolve the missing dependency/toolchain blocker locally, then rerun the same bounded CI-equivalent command.";
    case "release_gate_missing":
      return "Supply the missing release gate artifact, such as rollback or target-environment proof, before asking for approval.";
    default:
      return "Return the first failing CI step, the exact job output, and one bounded local repro command before widening scope.";
  }
}

function codexPromptForCause(args: {
  likelyCause: CiFailureLikelyCause;
  input: CiFailureTriageInput;
}): string {
  const repo = args.input.repo ?? "the target repo";
  const workflow = args.input.workflow;
  return [
    "```txt",
    `Work only in ${repo}.`,
    workflow ? `Focus on the CI workflow/job: ${workflow}${args.input.jobName ? ` / ${args.input.jobName}` : ""}.` : "Focus on the failing CI job only.",
    "Inspect the first failing step or mismatch.",
    "Run only the smallest local repro command for that step.",
    "Return cwd, exact command, exit code, first failing output, files changed, and what remains unverified.",
    "Do not widen scope, do not claim completion, and do not run release, publish, deploy, or destructive commands.",
    "```"
  ].join("\n");
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
