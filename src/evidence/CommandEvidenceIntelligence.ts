import fs from "node:fs/promises";
import path from "node:path";
import {
  CommandEvidenceFixtureFileSchema,
  CommandEvidenceIntelligenceInputSchema,
  type CommandEvidenceFamily,
  type CommandEvidenceFixtureCase,
  type CommandEvidenceIntelligenceInput,
  type CommandEvidenceIntelligenceResult,
  type CommandEvidenceStatus,
  type CommandProofStrength,
  type ParsedCommandEvidenceIntelligenceInput
} from "./CommandEvidenceIntelligenceSchemas.js";

export function classifyCommandEvidence(input: CommandEvidenceIntelligenceInput): CommandEvidenceIntelligenceResult {
  const parsed = CommandEvidenceIntelligenceInputSchema.parse(input);
  const commandFamily = commandFamilyForIntelligence(parsed.command);
  const limitations: string[] = [];
  const warnings: string[] = [];
  const output = parsed.output.toLowerCase();

  const proofStrength = chooseProofStrength(parsed, commandFamily, output, limitations, warnings);
  const status = commandStatus(parsed, proofStrength, output);

  return {
    command: parsed.command,
    commandFamily,
    status,
    proofStrength,
    limitations,
    warnings
  };
}

export async function loadCommandEvidenceFixtureCases(rootDir = process.cwd()): Promise<CommandEvidenceFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "command_evidence");
  const files = (await fs.readdir(fixtureDir)).filter((file) => file.endsWith(".json")).sort();
  const cases: CommandEvidenceFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...CommandEvidenceFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

export function commandFamilyForIntelligence(command: string): CommandEvidenceFamily {
  const normalized = command.toLowerCase();
  if (/\bdeploy\b|\bpublish\b|\brelease\b|\bsync_all\b|\bpublish_data_to_sheets\b/.test(normalized)) return "deploy";
  if (/\beval --redteam\b|\b--redteam\b/.test(normalized)) return "redteam";
  if (/\beval --regression\b|\b--regression\b/.test(normalized)) return "regression";
  if (/\beval\b/.test(normalized)) return "eval";
  if (/\be2e\b|\bplaywright\b|\bcypress\b/.test(normalized)) return "e2e";
  if (/\btypecheck\b|\btsc\b|\bcargo check\b|\bgo vet\b/.test(normalized)) return "typecheck";
  if (/\blint\b|\bclippy\b|\beslint\b|\brubocop\b/.test(normalized)) return "lint";
  if (/\bbuild\b|\bwebpack\b|\bvite build\b|\bnext build\b|\bcargo build\b|\bgo build\b|\bgradle assemble\b/.test(normalized)) return "build";
  if (/\btest\b|\bpytest\b|\bvitest\b|\bphpunit\b|\brspec\b|\bcargo test\b|\bgo test\b|\bmvn test\b|\bgradle test\b/.test(normalized)) return "test";
  if (/\bgh run\b|\bci\b|\bworkflow\b/.test(normalized)) return "ci";
  return "unknown";
}

function chooseProofStrength(
  input: ParsedCommandEvidenceIntelligenceInput,
  commandFamily: CommandEvidenceFamily,
  output: string,
  limitations: string[],
  warnings: string[]
): CommandProofStrength {
  if (input.expectedRepo && input.repo && input.repo !== input.expectedRepo) {
    limitations.push(`wrong repo: expected ${input.expectedRepo}, got ${input.repo}`);
    return "wrong_repo_proof";
  }

  if (input.expectedCwd && input.cwd && normalizePath(input.cwd) !== normalizePath(input.expectedCwd)) {
    limitations.push(`wrong cwd: expected ${input.expectedCwd}, got ${input.cwd}`);
    return "not_relevant_to_claim";
  }

  if (input.expectedBranch && input.branch && input.branch !== input.expectedBranch) {
    limitations.push(`wrong branch: expected ${input.expectedBranch}, got ${input.branch}`);
    return "wrong_branch_proof";
  }

  if (input.expectedCommitSha && input.commitSha && input.commitSha !== input.expectedCommitSha) {
    limitations.push(`wrong commit: expected ${input.expectedCommitSha}, got ${input.commitSha}`);
    return "stale_proof";
  }

  if (input.evidenceRequiredAfter && input.finishedAt && input.finishedAt < input.evidenceRequiredAfter) {
    limitations.push(`stale output: finished at ${input.finishedAt}, required after ${input.evidenceRequiredAfter}`);
    return "stale_proof";
  }

  if (input.source === "non_execution_evidence" || commandFamily === "unknown") {
    limitations.push("input is not executable command evidence");
    return "non_execution_evidence";
  }

  if (input.exitCode === undefined || input.exitCode === null) {
    limitations.push("missing exit code");
    return "partial_local_proof";
  }

  if (input.exitCode !== 0 || outputIndicatesFailure(output)) {
    limitations.push(`command failed with exit code ${input.exitCode}`);
    return "failed_proof";
  }

  if (input.source === "human_pasted_command_output") {
    limitations.push("human-pasted output is not local STAX command evidence");
    return "weak_human_pasted_proof";
  }

  if (input.source === "codex_reported_command_output") {
    limitations.push("Codex-reported output is not local STAX command evidence");
    return "weak_codex_reported_proof";
  }

  if (input.stdoutTruncated || input.stderrTruncated || /\b(truncated|partial log|snip|\.\.\.)\b/.test(output)) {
    limitations.push("command output is partial or truncated");
    return "partial_local_proof";
  }

  if (/\b(skipped|pending|todo)\b/.test(output)) {
    warnings.push("output includes skipped or pending tests");
    return "partial_local_proof";
  }

  if (!isRelevantToClaim(commandFamily, input.claimType)) {
    limitations.push(`${commandFamily} evidence does not prove ${input.claimType}`);
    return "not_relevant_to_claim";
  }

  if (input.source === "ci_workflow_output") {
    limitations.push("CI output is useful but external to local STAX execution");
    return "partial_local_proof";
  }

  return "strong_local_proof";
}

function outputIndicatesFailure(output: string): boolean {
  const withoutZeroFailures = output
    .replace(/\bfailed\s*[:=]?\s*0\b/g, "")
    .replace(/\b0\s+failures?\b/g, "")
    .replace(/\bcriticalfailures\s*[:=]?\s*0\b/g, "");
  return /\b(failed|failure|failures|error|exit code 1|exit 1)\b/.test(withoutZeroFailures);
}

function commandStatus(
  input: ParsedCommandEvidenceIntelligenceInput,
  proofStrength: CommandProofStrength,
  output: string
): CommandEvidenceStatus {
  if (proofStrength === "failed_proof") return "failed";
  if (proofStrength === "partial_local_proof") return "partial";
  if (input.exitCode === 0 && !/\b(skipped|pending|todo)\b/.test(output)) return "passed";
  if (input.exitCode === undefined || input.exitCode === null) return "unknown";
  return "partial";
}

function isRelevantToClaim(commandFamily: CommandEvidenceFamily, claimType: ParsedCommandEvidenceIntelligenceInput["claimType"]): boolean {
  if (claimType === "unspecified") return true;
  if (commandFamily === "ci") return claimType === "behavior" || claimType === "tests_passed" || claimType === "release_ready";
  if (claimType === "tests_passed") return commandFamily === "test" || commandFamily === "e2e" || commandFamily === "regression" || commandFamily === "redteam";
  if (claimType === "build_passed") return commandFamily === "build";
  if (claimType === "typecheck_passed") return commandFamily === "typecheck";
  if (claimType === "lint_passed") return commandFamily === "lint";
  if (claimType === "release_ready") return commandFamily === "deploy";
  if (claimType === "behavior") return commandFamily === "test" || commandFamily === "e2e" || commandFamily === "eval" || commandFamily === "regression" || commandFamily === "redteam";
  return true;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}
