import fs from "node:fs/promises";
import path from "node:path";
import {
  CommandEvidenceFixtureFileSchema,
  CommandEvidenceIntelligenceInputSchema,
  type CommandEvidenceClaimType,
  type CommandEvidenceFamily,
  type CommandEvidenceFixtureCase,
  type CommandEvidenceIntelligenceInput,
  type CommandEvidenceIntelligenceResult,
  type CommandEvidenceStatus,
  type CommandProofStrength,
  type ParsedCommandEvidenceIntelligenceInput
} from "./CommandEvidenceIntelligenceSchemas.js";

type ParsedOutputSignals = {
  passed: boolean;
  failed: boolean;
  partial: boolean;
  skipped: boolean;
  cancelled: boolean;
  testCount?: number;
  warningCount?: number;
};

export function classifyCommandEvidence(input: CommandEvidenceIntelligenceInput): CommandEvidenceIntelligenceResult {
  const parsed = CommandEvidenceIntelligenceInputSchema.parse(input);
  const commandFamily = commandFamilyForIntelligence(parsed.command);
  const toolchain = detectToolchain(parsed.command);
  const limitations: string[] = [];
  const warnings: string[] = [];
  const output = parsed.output.toLowerCase();
  const signals = parseOutputSignals(parsed.command, output);

  const proofStrength = chooseProofStrength(parsed, commandFamily, signals, limitations, warnings);
  const status = commandStatus(parsed, proofStrength, signals);

  return {
    command: parsed.command,
    commandFamily,
    status,
    proofStrength,
    toolchain,
    limitations,
    warnings
  };
}

export async function loadCommandEvidenceFixtureCases(rootDir = process.cwd()): Promise<CommandEvidenceFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "command_evidence");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("command_") && file.endsWith(".json"))
    .sort();
  const cases: CommandEvidenceFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...CommandEvidenceFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

export function commandFamilyForIntelligence(command: string): CommandEvidenceFamily {
  const normalized = normalizeCommand(command);

  if (/\b(sync_all\.cmd|publish_data_to_sheets\.bat|publish|deploy|release|sync)\b/.test(normalized)) return "deploy";
  if (/\b(eval --redteam|--redteam)\b/.test(normalized)) return "redteam";
  if (/\b(eval --regression|--regression)\b/.test(normalized)) return "regression";
  if (/\b(rax -- eval|eval)\b/.test(normalized)) return "eval";
  if (/\b(playwright|cypress|test:e2e|e2e:project|e2e)\b/.test(normalized)) return "e2e";
  if (/\b(typecheck|tsc --noemit|tsc -noemit|cargo check|go vet|mypy|pyright)\b/.test(normalized)) return "typecheck";
  if (/\b(lint|eslint|clippy|rubocop|ruff check)\b/.test(normalized)) return "lint";
  if (/\b(build|webpack|vite build|next build|cargo build|go build|gradle assemble|mvn package|mvnw package)\b/.test(normalized)) return "build";
  if (/\b(npm test|pnpm test|yarn test|vitest|jest|pytest|cargo test|go test|gradle test|gradlew test|mvn test|mvnw test|phpunit|composer test|bundle exec rspec|rspec)\b/.test(normalized)) {
    return "test";
  }
  if (/\b(gh run|github actions|workflow run|ci|run id|job:|matrix)\b/.test(normalized)) return "ci";
  return "unknown";
}

function chooseProofStrength(
  input: ParsedCommandEvidenceIntelligenceInput,
  commandFamily: CommandEvidenceFamily,
  signals: ParsedOutputSignals,
  limitations: string[],
  warnings: string[]
): CommandProofStrength {
  if (input.expectedRepo && input.repo && normalizePath(input.repo) !== normalizePath(input.expectedRepo)) {
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

  if (input.exitCode !== 0 || signals.failed) {
    limitations.push(`command failed with exit code ${input.exitCode}`);
    return "failed_proof";
  }

  if (signals.cancelled) {
    limitations.push("command or workflow was cancelled");
    return "partial_local_proof";
  }

  if (signals.skipped || signals.partial) {
    limitations.push("command output is partial, skipped, or incomplete");
    if (signals.skipped) warnings.push("output includes skipped or pending work");
    return "partial_local_proof";
  }

  if (input.source === "human_pasted_command_output") {
    limitations.push("human-pasted output is not local STAX command evidence");
    return "weak_human_pasted_proof";
  }

  if (input.source === "codex_reported_command_output") {
    limitations.push("Codex-reported output is not local STAX command evidence");
    return "weak_codex_reported_proof";
  }

  if (!isRelevantToClaim(commandFamily, input.claimType)) {
    limitations.push(`${commandFamily} evidence does not prove ${input.claimType}`);
    return "not_relevant_to_claim";
  }

  if (input.source === "ci_workflow_output" || commandFamily === "ci") {
    limitations.push("CI output is strong workflow evidence but external to local STAX execution");
    if (signals.warningCount && signals.warningCount > 0) {
      warnings.push(`workflow output reported ${signals.warningCount} warning lines`);
    }
    return "ci_proof";
  }

  if (input.stdoutTruncated || input.stderrTruncated) {
    limitations.push("command output is partial or truncated");
    return "partial_local_proof";
  }

  return "strong_local_proof";
}

function parseOutputSignals(command: string, output: string): ParsedOutputSignals {
  const normalized = output.toLowerCase();
  const commandFamily = commandFamilyForIntelligence(command);

  const cancelled = /\b(cancelled|canceled|aborted)\b/.test(normalized);
  const skipped = /\b(skipped|pending|todo)\b/.test(normalized);
  const partial = /\b(truncated|partial log|snip|\.\.\.|incomplete|timed out)\b/.test(normalized);

  const failed = outputIndicatesFailure(normalized);
  const passed = !failed && detectPassedSignal(commandFamily, normalized);
  const warningCount = countRegex(normalized, /\bwarning\b/g);
  const testCount = detectTestCount(normalized);

  return {
    passed,
    failed,
    partial,
    skipped,
    cancelled,
    testCount,
    warningCount
  };
}

function detectPassedSignal(commandFamily: CommandEvidenceFamily, output: string): boolean {
  switch (commandFamily) {
    case "test":
    case "e2e":
      return /\b(pass(?:ed)?|ok\b|tests?\s+passed|all tests passed|test files?\s+\d+\s+passed)\b/.test(output);
    case "build":
      return /\b(build (completed|passed|successful)|compiled successfully|bundle complete|done in \d)/.test(output);
    case "typecheck":
      return /\b(no type errors|typecheck passed|found 0 errors|0 errors)\b/.test(output);
    case "lint":
      return /\b(lint passed|0 problems|0 errors|no offenses detected)\b/.test(output);
    case "eval":
    case "regression":
    case "redteam":
      return /\b(pass rate|passed|failed\": 0|criticalfailures\": 0|\"failed\":0)\b/.test(output);
    case "ci":
      return /\b(conclusion[:=] success|status[:=] success|workflow completed successfully|all checks passed|job succeeded|completed successfully)\b/.test(output);
    case "deploy":
      return /\b(deploy completed|publish completed|release created|sync completed)\b/.test(output);
    default:
      return /\bpassed\b/.test(output);
  }
}

function outputIndicatesFailure(output: string): boolean {
  const withoutZeroFailures = output
    .replace(/"failed"\s*:\s*0/g, "")
    .replace(/"criticalfailures"\s*:\s*0/g, "")
    .replace(/"errors"\s*:\s*0/g, "")
    .replace(/\bfailed\s*[:=]?\s*0\b/g, "")
    .replace(/\b0\s+failed\b/g, "")
    .replace(/\b0\s+failures?\b/g, "")
    .replace(/\bcriticalfailures\s*[:=]?\s*0\b/g, "")
    .replace(/\berrors?\s*[:=]?\s*0\b/g, "")
    .replace(/\b0\s+errors?\b/g, "");
  return /\b(failed|failure|error|errors|panic|traceback|not ok|exited with code 1|exit code 1)\b/.test(withoutZeroFailures);
}

function commandStatus(
  input: ParsedCommandEvidenceIntelligenceInput,
  proofStrength: CommandProofStrength,
  signals: ParsedOutputSignals
): CommandEvidenceStatus {
  if (proofStrength === "failed_proof") return "failed";
  if (input.exitCode === undefined || input.exitCode === null) return "unknown";
  if (signals.partial || signals.skipped || signals.cancelled) return "partial";
  if (proofStrength === "partial_local_proof" || proofStrength === "ci_proof") return signals.passed ? "passed" : "partial";
  if (signals.failed) return "failed";
  if (input.exitCode === 0) return "passed";
  return "unknown";
}

function isRelevantToClaim(commandFamily: CommandEvidenceFamily, claimType: CommandEvidenceClaimType): boolean {
  if (claimType === "unspecified") return true;

  switch (claimType) {
    case "tests_passed":
      return ["test", "e2e", "regression", "redteam", "ci"].includes(commandFamily);
    case "build_passed":
      return commandFamily === "build";
    case "typecheck_passed":
      return commandFamily === "typecheck";
    case "lint_passed":
      return commandFamily === "lint";
    case "release_ready":
      return commandFamily === "deploy" || commandFamily === "ci";
    case "behavior":
      return ["test", "e2e", "eval", "regression", "redteam", "ci"].includes(commandFamily);
    default:
      return true;
  }
}

function detectToolchain(command: string): string | undefined {
  const normalized = normalizeCommand(command);
  if (/\bpnpm\b/.test(normalized)) return "pnpm";
  if (/\byarn\b/.test(normalized)) return "yarn";
  if (/\bnpm\b/.test(normalized)) return "npm";
  if (/\bvitest\b/.test(normalized)) return "vitest";
  if (/\bjest\b/.test(normalized)) return "jest";
  if (/\bpytest\b/.test(normalized)) return "pytest";
  if (/\bcargo\b/.test(normalized)) return "cargo";
  if (/\bgo test\b|\bgo build\b|\bgo vet\b/.test(normalized)) return "go";
  if (/\bgradlew?\b/.test(normalized)) return "gradle";
  if (/\bmvnw?\b/.test(normalized)) return "maven";
  if (/\bcomposer\b|\bphpunit\b/.test(normalized)) return "php";
  if (/\bbundle\b|\brspec\b/.test(normalized)) return "ruby";
  if (/\bgh run\b|\bgithub actions\b/.test(normalized)) return "github_actions";
  return undefined;
}

function detectTestCount(output: string): number | undefined {
  const patterns = [
    /\btest files?\s+(\d+)\s+passed\b/,
    /\b(\d+)\s+passed\b/,
    /\bcollected\s+(\d+)\s+items\b/,
    /\bran\s+(\d+)\s+tests?\b/,
    /\btests?:\s*(\d+)\s+passed\b/
  ];
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return undefined;
}

function countRegex(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function normalizeCommand(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}
