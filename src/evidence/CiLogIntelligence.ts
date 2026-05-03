import fs from "node:fs/promises";
import path from "node:path";
import type { CommandProofStrength, CommandEvidenceStatus } from "./CommandEvidenceIntelligenceSchemas.js";
import {
  CiLogFixtureFileSchema,
  CiLogIntelligenceInputSchema,
  type CiLogFixtureCase,
  type CiLogIntelligenceInput,
  type CiLogIntelligenceResult,
  type ParsedCiLogIntelligenceInput
} from "./CiLogIntelligenceSchemas.js";

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

export function classifyCiLogEvidence(input: CiLogIntelligenceInput): CiLogIntelligenceResult {
  const parsed = CiLogIntelligenceInputSchema.parse(input);
  const flags: string[] = [];
  const limitations: string[] = [];
  const warnings: string[] = [];
  const logText = `${parsed.summary}\n${parsed.log}`.toLowerCase();

  if (parsed.expectedWorkflow && parsed.workflow !== parsed.expectedWorkflow) {
    limitations.push(`unrelated workflow: expected ${parsed.expectedWorkflow}, got ${parsed.workflow}`);
    flags.push("unrelated_workflow");
    return buildResult(parsed, "unknown", "not_relevant_to_claim", "unknown", flags, limitations, warnings);
  }

  if (parsed.expectedBranch && parsed.branch && parsed.branch !== parsed.expectedBranch) {
    limitations.push(`wrong branch: expected ${parsed.expectedBranch}, got ${parsed.branch}`);
    flags.push("wrong_branch");
    return buildResult(parsed, "unknown", "wrong_branch_proof", "unknown", flags, limitations, warnings);
  }

  if (parsed.expectedCommitSha && parsed.commitSha && parsed.commitSha !== parsed.expectedCommitSha) {
    limitations.push(`wrong commit: expected ${parsed.expectedCommitSha}, got ${parsed.commitSha}`);
    flags.push("wrong_commit");
    return buildResult(parsed, "unknown", "stale_proof", "unknown", flags, limitations, warnings);
  }

  if (parsed.evidenceRequiredAfter && parsed.finishedAt && parsed.finishedAt < parsed.evidenceRequiredAfter) {
    limitations.push(`stale run: finished at ${parsed.finishedAt}, required after ${parsed.evidenceRequiredAfter}`);
    flags.push("stale_run");
    return buildResult(parsed, "unknown", "stale_proof", "unknown", flags, limitations, warnings);
  }

  const signal = deriveConclusionSignal(parsed, logText);
  const matrixState = deriveMatrixState(parsed, signal.flags);
  flags.push(...signal.flags);

  if (signal.conclusion === "failure") {
    limitations.push("workflow or job failed");
    return buildResult(parsed, "failed", "failed_proof", matrixState, flags, limitations, warnings);
  }

  if (signal.conclusion === "cancelled") {
    limitations.push("workflow or job was cancelled");
    return buildResult(parsed, "partial", "partial_local_proof", matrixState, flags, limitations, warnings);
  }

  if (signal.conclusion === "skipped") {
    limitations.push("workflow or job was skipped");
    return buildResult(parsed, "partial", "partial_local_proof", matrixState, flags, limitations, warnings);
  }

  if (signal.conclusion === "pending") {
    limitations.push("workflow is still pending");
    return buildResult(parsed, "partial", "partial_local_proof", matrixState, flags, limitations, warnings);
  }

  if (matrixState === "partial") {
    limitations.push("matrix or job set is only partially complete");
    return buildResult(parsed, "partial", "partial_local_proof", matrixState, flags, limitations, warnings);
  }

  if (signal.conclusion === "success") {
    limitations.push("CI output is external workflow evidence, not local STAX execution");
    if (countRegex(logText, /\bwarning\b/g) > 0) {
      warnings.push(`workflow output reported ${countRegex(logText, /\bwarning\b/g)} warning lines`);
    }
    if (parsed.attempt !== undefined && parsed.attempt > 1) {
      warnings.push(`workflow succeeded on rerun attempt ${parsed.attempt}`);
      flags.push("retried_success");
    }
    if (/\b(retry passed|retried and passed|re-run succeeded)\b/.test(logText)) {
      warnings.push("workflow required a retry before succeeding");
      flags.push("retried_success");
    }
    return buildResult(parsed, "passed", "ci_proof", matrixState, flags, limitations, warnings);
  }

  limitations.push("workflow conclusion is unknown");
  return buildResult(parsed, "unknown", "partial_local_proof", matrixState, flags, limitations, warnings);
}

export async function loadCiLogFixtureCases(rootDir = process.cwd()): Promise<CiLogFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "ci_logs");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("ci_") && file.endsWith(".json"))
    .sort();
  const cases: CiLogFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...CiLogFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

function buildResult(
  parsed: ParsedCiLogIntelligenceInput,
  status: CommandEvidenceStatus,
  proofStrength: CommandProofStrength,
  matrixState: "complete" | "partial" | "unknown",
  flags: string[],
  limitations: string[],
  warnings: string[]
): CiLogIntelligenceResult {
  return {
    workflow: parsed.workflow,
    status,
    proofStrength,
    matrixState,
    flags: dedupe(flags),
    limitations: dedupe(limitations),
    warnings: dedupe(warnings)
  };
}

function deriveConclusionSignal(parsed: ParsedCiLogIntelligenceInput, logText: string): {
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "pending" | "unknown";
  flags: string[];
} {
  const flags: string[] = [];
  const explicit = parsed.conclusion;

  if (parsed.failedJobCount > 0 || /\b(failure|failed|error|errors|exit code 1)\b/.test(logText)) {
    flags.push("job_failed");
    return { conclusion: explicit === "success" ? "success" : "failure", flags };
  }
  if (/\b(timed out|timed_out|timeout)\b/.test(logText)) {
    flags.push("job_timed_out");
    return { conclusion: explicit === "success" ? "success" : "failure", flags };
  }
  if (parsed.cancelledJobCount > 0 || /\b(cancelled|canceled|aborted)\b/.test(logText)) {
    flags.push("job_cancelled");
    return { conclusion: explicit === "success" ? "success" : "cancelled", flags };
  }
  if (parsed.skippedJobCount > 0 || /\b(skipped|not run)\b/.test(logText)) {
    flags.push("job_skipped");
    return { conclusion: explicit === "success" ? "success" : "skipped", flags };
  }

  if (explicit !== "unknown") {
    return { conclusion: explicit, flags };
  }
  if (/\b(pending|queued|in progress)\b/.test(logText)) return { conclusion: "pending", flags };
  if (/\b(conclusion[:=] success|completed successfully|all checks passed|job succeeded)\b/.test(logText)) {
    return { conclusion: "success", flags };
  }
  return { conclusion: "unknown", flags };
}

function deriveMatrixState(
  parsed: ParsedCiLogIntelligenceInput,
  flags: string[]
): "complete" | "partial" | "unknown" {
  const accountedJobs =
    (parsed.completedJobCount ?? 0) +
    parsed.failedJobCount +
    parsed.cancelledJobCount +
    parsed.skippedJobCount;

  if (parsed.expectedJobCount !== undefined) {
    if (accountedJobs < parsed.expectedJobCount) {
      flags.push("matrix_incomplete");
      return "partial";
    }
    if (parsed.failedJobCount > 0 || parsed.cancelledJobCount > 0 || parsed.skippedJobCount > 0) {
      flags.push("matrix_partial_failure");
      return "partial";
    }
    return "complete";
  }

  if (parsed.failedJobCount > 0 || parsed.cancelledJobCount > 0 || parsed.skippedJobCount > 0) {
    flags.push("matrix_partial_failure");
    return "partial";
  }

  return "unknown";
}

function countRegex(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}
