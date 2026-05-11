import type { CommandEvidence } from "./CommandEvidenceStore.js";
import {
  ProofStrengthInputSchema,
  ProofStrengthResultSchema,
  type ProofStrengthCap,
  type ProofStrengthClaimType,
  type ProofStrengthInput,
  type ProofStrengthLabel,
  type ProofStrengthResult,
  type ProofStrengthTraceSummary
} from "./ProofStrengthSchemas.js";

const COMMAND_REQUIRED_CLAIMS = new Set<ProofStrengthClaimType>([
  "implementation_complete",
  "tests_passed",
  "release_ready",
  "security_fixed",
  "verification_run"
]);

const LABEL_MAX_SCORE: Record<Exclude<ProofStrengthLabel, "Reject" | "Audit-grade">, number> = {
  Missing: 0.19,
  Weak: 0.44,
  Provisional: 0.69,
  Strong: 0.89
};

export class ProofStrengthGate {
  evaluate(input: ProofStrengthInput): ProofStrengthResult {
    const parsed = ProofStrengthInputSchema.parse(input);
    const strongProof: string[] = [];
    const weakProof: string[] = [];
    const missingProof: string[] = [];
    const capApplied: ProofStrengthCap[] = [];
    const rejectReasons: string[] = [];

    const localPassingCommands = parsed.commandEvidence.filter((item) => isLocalPassingCommand(item));
    const unverifiedLocalCommands = parsed.commandEvidence.filter((item) => item.source === "local_stax_command_output" && !isVerifiedLocalStaxCommand(item));
    const provisionalCommands = parsed.commandEvidence.filter((item) => item.success && (item.source !== "local_stax_command_output" || unverifiedLocalCommands.includes(item)));
    const commandEvidenceExists = parsed.commandEvidence.length > 0;
    const onlyCodexReportedCommands =
      parsed.commandEvidence.length > 0 && parsed.commandEvidence.every((item) => item.source === "codex_reported_command_output");

    for (const claim of parsed.groundingResult.supportedClaims) {
      strongProof.push(`Grounded ${claim.kind} claim: ${claim.text}.`);
    }
    for (const claim of parsed.groundingResult.weakClaims) {
      weakProof.push(`Weak ${claim.kind} claim: ${claim.text}${claim.reason ? ` (${claim.reason})` : ""}.`);
    }
    for (const claim of parsed.groundingResult.unsupportedClaims) {
      missingProof.push(`Unsupported ${claim.kind} claim: ${claim.text}${claim.reason ? ` (${claim.reason})` : ""}.`);
    }

    for (const command of localPassingCommands) {
      strongProof.push(`Local STAX command evidence passed: ${command.command} exited ${command.exitCode}.`);
    }
    if (parsed.claimType === "verification_run" && localPassingCommands.length > 0) {
      strongProof.push("Verified local STAX command provenance is present for this repo state.");
    }
    for (const command of unverifiedLocalCommands) {
      weakProof.push(
        `Local STAX command evidence label is unverified for ${command.command}${command.provenanceStatus ? ` (${command.provenanceStatus})` : ""}.`
      );
    }
    for (const command of provisionalCommands) {
      weakProof.push(`${command.source} is provisional command evidence for ${command.command}.`);
    }

    if (parsed.repoEvidence) {
      if (parsed.repoEvidence.sourceFiles.length > 0) strongProof.push("Repo evidence enumerated source files.");
      if (parsed.repoEvidence.testFiles.length > 0) strongProof.push("Repo evidence enumerated test files.");
    } else {
      missingProof.push("No repo evidence pack was supplied.");
    }

    if (!commandEvidenceExists && COMMAND_REQUIRED_CLAIMS.has(parsed.claimType)) {
      missingProof.push(`${parsed.claimType} requires local command evidence.`);
      capApplied.push({
        id: "missing_command_evidence",
        maxLabel: "Provisional",
        reason: "No command evidence can prove this claim above Provisional."
      });
    }

    if (onlyCodexReportedCommands) {
      capApplied.push({
        id: "codex_reported_command_only",
        maxLabel: "Provisional",
        reason: "Codex-reported command output is provisional until captured locally."
      });
    }
    if (unverifiedLocalCommands.length > 0 && COMMAND_REQUIRED_CLAIMS.has(parsed.claimType)) {
      capApplied.push({
        id: "unverified_local_command_provenance",
        maxLabel: "Provisional",
        reason: "A local STAX command label is only strong proof after provenance verification."
      });
    }

    for (const command of parsed.commandEvidence) {
      if (!command.success || command.exitCode !== 0 || command.status === "failed") {
        rejectReasons.push(`Failed command evidence: ${command.command} exited ${command.exitCode}.`);
      }
    }

    const expectedRepoPath = parsed.expectedRepoPath ?? parsed.repoEvidence?.repoPath;
    const expectedWorkspace = parsed.expectedWorkspace ?? parsed.repoEvidence?.workspace;
    for (const command of parsed.commandEvidence) {
      if (expectedRepoPath && command.cwd && normalizePath(command.cwd) !== normalizePath(expectedRepoPath)) {
        rejectReasons.push(`Wrong repo/cwd command evidence: ${command.cwd} does not match ${expectedRepoPath}.`);
      }
      if (expectedRepoPath && command.linkedRepoPath && normalizePath(command.linkedRepoPath) !== normalizePath(expectedRepoPath)) {
        rejectReasons.push(`Wrong linked repo command evidence: ${command.linkedRepoPath} does not match ${expectedRepoPath}.`);
      }
      if (expectedWorkspace && command.workspace && command.workspace !== expectedWorkspace) {
        rejectReasons.push(`Wrong workspace command evidence: ${command.workspace} does not match ${expectedWorkspace}.`);
      }
    }

    if (parsed.claimType === "implementation_complete" && isDocsOnlyImplementationProof(parsed)) {
      rejectReasons.push("Docs-only evidence cannot prove an implementation-complete claim.");
    }

    if (parsed.claimType === "visual_behavior_verified" && !parsed.evidenceFlags.visualProof) {
      missingProof.push("No screenshot, rendered preview, Playwright trace, or visual proof was supplied.");
      capApplied.push({
        id: "visual_claim_without_visual_proof",
        maxLabel: "Provisional",
        reason: "Visual behavior claims require rendered visual proof."
      });
    }

    if (parsed.claimType === "release_ready" && !(parsed.evidenceFlags.releasePreflight || parsed.evidenceFlags.releaseGate || parsed.evidenceFlags.rollbackPlan)) {
      missingProof.push("No release preflight, release gate, dry run, or rollback proof was supplied.");
      capApplied.push({
        id: "release_ready_without_release_proof",
        maxLabel: "Provisional",
        reason: "Release-ready claims require release/preflight proof."
      });
    }

    if (parsed.claimType === "security_fixed" && !parsed.evidenceFlags.securityProof) {
      missingProof.push("No security-specific test, scan, or vulnerability proof was supplied.");
      capApplied.push({
        id: "security_fixed_without_security_proof",
        maxLabel: "Provisional",
        reason: "Security-fixed claims require security-specific proof."
      });
    }

    if (parsed.evidenceFlags.visualProof) strongProof.push("Rendered visual proof was supplied.");
    if (parsed.evidenceFlags.releasePreflight) strongProof.push("Release preflight proof was supplied.");
    if (parsed.evidenceFlags.releaseGate) strongProof.push("Release gate proof was supplied.");
    if (parsed.evidenceFlags.rollbackPlan) strongProof.push("Rollback proof was supplied.");
    if (parsed.evidenceFlags.securityProof) strongProof.push("Security-specific proof was supplied.");

    const rawScore = roundScore(rawProofScore(parsed.claimType, {
      groundingSupported: parsed.groundingResult.supportedClaims.length,
      groundingWeak: parsed.groundingResult.weakClaims.length,
      groundingUnsupported: parsed.groundingResult.unsupportedClaims.length,
      localPassingCommands: localPassingCommands.length,
      provisionalCommands: provisionalCommands.length,
      repoSourceFiles: parsed.repoEvidence?.sourceFiles.length ?? 0,
      repoTestFiles: parsed.repoEvidence?.testFiles.length ?? 0,
      visualProof: parsed.evidenceFlags.visualProof,
      releaseProof: parsed.evidenceFlags.releasePreflight || parsed.evidenceFlags.releaseGate || parsed.evidenceFlags.rollbackPlan,
      securityProof: parsed.evidenceFlags.securityProof
    }));

    const capScore = capApplied.reduce((score, cap) => Math.min(score, LABEL_MAX_SCORE[cap.maxLabel]), 1);
    const finalScore = rejectReasons.length > 0 ? 0 : roundScore(Math.min(rawScore, capScore));
    const label = rejectReasons.length > 0 ? "Reject" : labelForScore(finalScore);
    const primaryLimiter = primaryLimiterFor({ rejectReasons, capApplied, missingProof, weakProof, label });
    const oneNextAction = nextActionFor(parsed.claimType, primaryLimiter, rejectReasons, capApplied, missingProof);

    return ProofStrengthResultSchema.parse({
      schemaVersion: "proof-strength-v1",
      claimType: parsed.claimType,
      claimText: parsed.claimText,
      rawScore,
      finalScore,
      label,
      capApplied: dedupeCaps(capApplied),
      rejectReasons: unique(rejectReasons),
      primaryLimiter,
      missingProof: unique(missingProof),
      weakProof: unique(weakProof),
      strongProof: unique(strongProof),
      oneNextAction
    });
  }
}

export function inferProofStrengthClaimType(text: string): ProofStrengthClaimType | undefined {
  if (/\b(ui|visual|layout|screenshot|rendered|browser|resize|css|looks)\b/i.test(text)) return "visual_behavior_verified";
  if (/\b(release ready|ready to release|deploy|publish|production|rollback|preflight)\b/i.test(text)) return "release_ready";
  if (/\b(security|vulnerab|xss|csrf|injection|secret|auth bypass)\b/i.test(text)) return "security_fixed";
  if (/\b(tests? passed|npm test passed|all tests passed|test suite passed)\b/i.test(text)) return "tests_passed";
  if (/\b(implemented|implementation complete|fixed|complete|completed|done|ready|works)\b/i.test(text)) return "implementation_complete";
  return undefined;
}

export function summarizeProofStrength(result: ProofStrengthResult | undefined): ProofStrengthTraceSummary | undefined {
  if (!result) return undefined;
  return {
    label: result.label,
    rawScore: result.rawScore,
    finalScore: result.finalScore,
    capApplied: result.capApplied.map((cap) => cap.id),
    primaryLimiter: result.primaryLimiter
  };
}

function isLocalPassingCommand(command: CommandEvidence): boolean {
  return isVerifiedLocalStaxCommand(command) && command.success && command.exitCode === 0 && command.status !== "failed";
}

function isVerifiedLocalStaxCommand(command: CommandEvidence): boolean {
  return command.source === "local_stax_command_output" && command.provenanceStatus === "verified_local_stax_command";
}

function isDocsOnlyImplementationProof(input: ReturnType<typeof ProofStrengthInputSchema.parse>): boolean {
  const fileClaims = input.groundingResult.supportedClaims.filter((claim) => claim.kind === "file_path");
  if (!input.repoEvidence || fileClaims.length === 0) return false;
  const docs = new Set(input.repoEvidence.docsFiles.map(normalizeRelativePath));
  const source = new Set([...input.repoEvidence.sourceFiles, ...input.repoEvidence.testFiles].map(normalizeRelativePath));
  return fileClaims.every((claim) => docs.has(normalizeRelativePath(claim.text))) && fileClaims.every((claim) => !source.has(normalizeRelativePath(claim.text)));
}

function rawProofScore(
  claimType: ProofStrengthClaimType,
  input: {
    groundingSupported: number;
    groundingWeak: number;
    groundingUnsupported: number;
    localPassingCommands: number;
    provisionalCommands: number;
    repoSourceFiles: number;
    repoTestFiles: number;
    visualProof: boolean;
    releaseProof: boolean;
    securityProof: boolean;
  }
): number {
  let score = 0;
  if (input.groundingSupported > 0) score += Math.min(0.25, 0.1 * input.groundingSupported);
  if (input.groundingWeak > 0) score += 0.08;
  if (input.localPassingCommands > 0) {
    score += claimType === "tests_passed" ? 0.55 : claimType === "verification_run" ? 0.7 : 0.35;
  } else if (input.provisionalCommands > 0) {
    score += 0.42;
  }
  if (claimType === "implementation_complete" && input.repoSourceFiles > 0) score += 0.18;
  if (claimType === "implementation_complete" && input.repoTestFiles > 0) score += 0.12;
  if (claimType === "visual_behavior_verified" && input.visualProof) score += 0.55;
  if (claimType === "release_ready" && input.releaseProof) score += 0.35;
  if (claimType === "security_fixed" && input.securityProof) score += 0.4;
  score -= Math.min(0.3, 0.08 * input.groundingUnsupported);
  return clamp(score, 0, 1);
}

function labelForScore(score: number): ProofStrengthLabel {
  if (score < 0.2) return "Missing";
  if (score < 0.45) return "Weak";
  if (score < 0.7) return "Provisional";
  if (score < 0.9) return "Strong";
  return "Audit-grade";
}

function primaryLimiterFor(input: {
  rejectReasons: string[];
  capApplied: ProofStrengthCap[];
  missingProof: string[];
  weakProof: string[];
  label: ProofStrengthLabel;
}): string {
  if (input.rejectReasons[0]) return input.rejectReasons[0];
  if (input.capApplied[0]) return input.capApplied[0].reason;
  if (input.missingProof[0]) return input.missingProof[0];
  return input.label === "Audit-grade" || input.label === "Strong"
    ? "Available proof is strong enough for this claim type."
    : input.weakProof[0] ?? "Available proof is not yet strong enough for this claim type.";
}

function nextActionFor(
  claimType: ProofStrengthClaimType,
  primaryLimiter: string,
  rejectReasons: string[],
  capApplied: ProofStrengthCap[],
  missingProof: string[]
): string {
  const combined = [primaryLimiter, ...rejectReasons, ...capApplied.map((cap) => cap.id), ...missingProof].join("\n").toLowerCase();
  if (combined.includes("available proof is strong enough")) return "No proof-strength correction is needed for this claim.";
  if (combined.includes("failed command")) return "Fix the failing command, rerun it through STAX command evidence, then re-gate the claim.";
  if (combined.includes("wrong repo") || combined.includes("wrong workspace") || combined.includes("wrong linked repo")) {
    return "Collect command evidence from the correct repo/workspace and discard the mismatched proof.";
  }
  if (combined.includes("docs-only")) return "Provide source diff plus behavior or test evidence; docs-only proof cannot prove implementation.";
  if (combined.includes("visual")) return "Capture rendered visual proof, such as a screenshot or Playwright trace, for the claimed behavior.";
  if (combined.includes("release")) return "Run the release preflight or release gate and include rollback/dry-run evidence.";
  if (combined.includes("security")) return "Run security-specific tests or scans and attach the captured local evidence.";
  if (combined.includes("command")) {
    return claimType === "tests_passed"
      ? "Run the test command through local STAX command evidence, then rerun the proof gate."
      : "Run the repo's relevant local proof command through STAX command evidence.";
  }
  return "Add the missing proof item, then rerun the proof-strength gate.";
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}

function normalizeRelativePath(value: string): string {
  return normalizePath(value).replace(/^\.?\//, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function dedupeCaps(caps: ProofStrengthCap[]): ProofStrengthCap[] {
  const seen = new Set<string>();
  return caps.filter((cap) => {
    if (seen.has(cap.id)) return false;
    seen.add(cap.id);
    return true;
  });
}
