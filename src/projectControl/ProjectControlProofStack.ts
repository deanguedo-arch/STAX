import { decomposeClaimsFromReport, mapClaimToProof, requiredProofForClaim } from "../claims/ClaimProofMapping.js";
import type { ClaimProofClaimType, ClaimProofItem } from "../claims/ClaimProofMappingSchemas.js";
import { auditDiffEvidence } from "../diffAudit/DiffAudit.js";
import type { DiffAuditInput } from "../diffAudit/DiffAuditSchemas.js";
import { parseUnifiedDiff } from "../diffAudit/UnifiedDiffParser.js";
import { classifyCommandEvidence } from "../evidence/CommandEvidenceIntelligence.js";
import type { CommandEvidenceClaimType, CommandEvidenceSource } from "../evidence/CommandEvidenceIntelligenceSchemas.js";
import { analyzeDataPipelineProof } from "../evidence/DataPipelineProofAnalyzer.js";
import { analyzeReleaseGate } from "../evidence/ReleaseGateAnalyzer.js";
import { analyzeTestQuality } from "../evidence/TestQualityAnalyzer.js";
import { analyzeVisualProof } from "../evidence/VisualProofAnalyzer.js";
import type {
  ProjectControlChangedFile,
  ProjectControlCommandEvidenceEntry,
  ProjectControlDataProofArtifact,
  ProjectControlHumanApproval,
  ProjectControlReleaseProofArtifact,
  ProjectControlVisualEvidence,
  PullRequestArtifactPacket
} from "./ProjectControlEvidencePacket.js";
import { analyzeCodexReportContract } from "./CodexReportContract.js";
import { auditPullRequestArtifact } from "./PullRequestArtifactAudit.js";

export type ProjectControlProofStackInput = {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
  changedFiles?: ProjectControlChangedFile[];
  unifiedDiff?: string;
  commandEvidenceEntries?: ProjectControlCommandEvidenceEntry[];
  visualEvidence?: ProjectControlVisualEvidence[];
  dataProofArtifacts?: ProjectControlDataProofArtifact[];
  releaseProofArtifacts?: ProjectControlReleaseProofArtifact[];
  humanApproval?: ProjectControlHumanApproval[];
  pullRequestArtifact?: PullRequestArtifactPacket;
  targetRepoPath?: string;
  expectedRepo?: string;
  expectedBranch?: string;
  expectedCommitSha?: string;
  expectedCwd?: string;
};

export type ProjectControlProofStackResult = {
  verified: string[];
  weak: string[];
  unverified: string[];
  risk: string[];
};

type DerivedClaim = {
  claimType: ClaimProofClaimType;
  claim: string;
  hardClaim: boolean;
};

type DiffAuditClaimInput = NonNullable<DiffAuditInput["claims"]>[number];
type DiffChangedFileInput = DiffAuditInput["changedFiles"][number];

export function buildProjectControlProofStack(
  input: ProjectControlProofStackInput
): ProjectControlProofStackResult {
  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risk: string[] = [];
  const combined = [input.task, input.repoEvidence, input.commandEvidence, input.codexReport].join("\n");
  const codexReportContract = analyzeCodexReportContract(input.codexReport);

  if (codexReportContract.status === "well_formed") {
    verified.push("Codex report contract includes Files changed, Commands run, What is verified, What is unverified, and Risks.");
  } else if (codexReportContract.status === "partial") {
    weak.push(`Codex report contract is partial because ${codexReportContract.issues[0] ?? "some required sections are missing"}.`);
  } else if (codexReportContract.status === "malformed") {
    unverified.push(`Codex report contract is malformed because ${codexReportContract.issues[0] ?? "required sections are missing"}.`);
    risk.push("Malformed Codex report risk: fake-complete language can outrun the proof stack when files, commands, and residual unknowns are omitted.");
  }

  if (input.pullRequestArtifact) {
    const prAudit = auditPullRequestArtifact({
      packet: input.pullRequestArtifact,
      task: input.task,
      expectedBranch: input.expectedBranch,
      expectedCommitSha: input.expectedCommitSha
    });
    verified.push(...prAudit.verified.map((line) => `PR artifact audit: ${line}`));
    weak.push(...prAudit.weak.map((line) => `PR artifact audit: ${line}`));
    unverified.push(...prAudit.unverified.map((line) => `PR artifact audit: ${line}`));
    risk.push(...prAudit.risk.map((line) => `PR artifact audit: ${line}`));
    if (prAudit.verdict === "human_review") {
      weak.push("PR artifact audit requires human review before approval.");
    }
  }

  const claimSource = input.codexReport.trim() ? [input.task, input.codexReport].join("\n") : input.task;
  const derivedClaims = deriveClaims(claimSource);
  const changedFiles = resolveChangedFiles(input, combined);
  if (changedFiles.length > 0 && derivedClaims.length > 0) {
    const diffClaims: DiffAuditClaimInput[] = [];
    for (const claim of derivedClaims) {
      const diffClaimType = claimToDiffClaimType(claim.claimType);
      if (!diffClaimType) continue;
      diffClaims.push({
        claimType: diffClaimType,
        text: claim.claim,
        hardClaim: claim.hardClaim
      });
    }
    const diffAudit = diffClaims.length > 0 ? auditDiffEvidence({
      repo: repoLabel(input),
      branch: detectBranch(combined) ?? "unknown",
      baseSha: detectSha(combined, "base") ?? "unknown-base",
      headSha: detectSha(combined, "head") ?? "unknown-head",
      objective: input.task.trim() || "Project-control audit",
      changedFiles,
      claims: diffClaims,
      evidence: {
        behaviorTestEvidence: /\b(test|eval|e2e|playwright|pytest|vitest|rspec|phpunit)\b/i.test(input.commandEvidence),
        commandEvidenceAfterDiff: /\b(exit code|passed|failed|run-|runs\/)\b/i.test(input.commandEvidence),
        visualProofProvided:
          input.visualEvidence !== undefined
            ? input.visualEvidence.length > 0
            : /\b(screenshot|rendered preview|visual checklist|playwright screenshot)\b/i.test(combined),
        dependencyProofProvided: /\bnpm ls\b|\bpnpm list\b|\byarn why\b|\bpip show\b|\bcargo tree\b|\bcomposer show\b|\bbundle info\b/i.test(combined),
        rollbackProofProvided: /\brollback\b|\brevert\b|\bdowngrade\b/i.test(combined),
        securityProofProvided: /\baudit:security\b|\bsecurity audit\b|\bsecurity test\b|\bsecret scan\b|\bvulnerability scan\b|\bprompt injection\b/i.test(combined),
        humanApprovalForForbidden:
          input.humanApproval !== undefined
            ? input.humanApproval.length > 0
            : /\bapproved by|human approval|approval metadata\b/i.test(combined),
        taskScopePaths: deriveScopePaths(changedFiles),
        forbiddenPaths: []
      }
    }) : undefined;

    if (diffAudit) {
      const findingSummary = diffAudit.findings.slice(0, 3).map((finding) => finding.id).join(", ");
      if (diffAudit.verdict === "accept") {
        verified.push(`Diff audit: accept${findingSummary ? ` (${findingSummary})` : ""}.`);
      } else if (diffAudit.verdict === "provisional") {
        weak.push(`Diff audit: provisional due to ${findingSummary || "missing proof-driving diff support"}.`);
      } else {
        unverified.push(`Diff audit: ${diffAudit.verdict} due to ${findingSummary || "unsupported diff claim"}.`);
        risk.push(...diffAudit.findings.slice(0, 2).map((finding) => `Diff risk: ${finding.message}`));
      }
    }
  }

  const commandInsight = deriveCommandInsight(input);
  if (commandInsight) {
    const label = `Command evidence classifier: ${commandInsight.proofStrength} for ${commandInsight.command}.`;
    if (commandInsight.proofStrength === "strong_local_proof") {
      verified.push(label);
    } else if (
      commandInsight.proofStrength === "ci_proof" ||
      commandInsight.proofStrength === "weak_human_pasted_proof" ||
      commandInsight.proofStrength === "weak_codex_reported_proof" ||
      commandInsight.proofStrength === "partial_local_proof"
    ) {
      weak.push(label);
    } else {
      unverified.push(label);
    }

    for (const limitation of commandInsight.limitations.slice(0, 2)) {
      risk.push(`Command evidence risk: ${limitation}.`);
    }
    for (const warning of commandInsight.warnings.slice(0, 2)) {
      weak.push(`Command evidence warning: ${warning}.`);
    }
  }

  for (const claim of derivedClaims) {
    const suppliedProof = deriveProofItems(
      claim,
      changedFiles,
      input.changedFiles,
      input.visualEvidence,
      input.dataProofArtifacts,
      input.releaseProofArtifacts,
      commandInsight,
      input.commandEvidenceEntries,
      combined
    );
    const mapped = mapClaimToProof({
      claimType: claim.claimType,
      claim: claim.claim,
      hardClaim: claim.hardClaim,
      suppliedProof
    });
    if (mapped.verdict === "accept") {
      verified.push(`Claim-to-proof: ${claim.claimType} claim is fully supported.`);
      continue;
    }

    const proofGaps = [...mapped.missingProof, ...mapped.weakProof].slice(0, 3).join(", ");
    if (mapped.verdict === "provisional") {
      weak.push(`Claim-to-proof: ${claim.claimType} claim is provisional because ${proofGaps}.`);
    } else {
      unverified.push(`Claim-to-proof: ${claim.claimType} claim is unsupported because ${proofGaps}.`);
      if (mapped.unsupportedHardClaim) {
        risk.push(`Unsupported hard claim: ${claim.claimType} requires ${requiredProofForClaim(claim.claimType).join(", ")}.`);
      }
    }
  }

  return {
    verified: dedupe(verified),
    weak: dedupe(weak),
    unverified: dedupe(unverified),
    risk: dedupe(risk)
  };
}

type CommandInsight = ReturnType<typeof classifyCommandEvidence> & { command: string };

function deriveCommandInsight(input: ProjectControlProofStackInput): CommandInsight | undefined {
  const claimType = detectCommandClaimType([input.task, input.codexReport].join("\n"));
  const structuredEntry = selectStructuredCommandEvidenceEntry(input, claimType);
  const command = structuredEntry?.command ?? detectCommand(input.commandEvidence);
  if (!command) return undefined;
  const source = structuredEntry?.source ?? detectCommandSource(input.commandEvidence, input.codexReport);
  return {
    ...classifyCommandEvidence({
      command,
      cwd: structuredEntry?.cwd ?? detectCwd(input.commandEvidence),
      repo: structuredEntry?.repo ?? detectRepo(input.commandEvidence),
      branch: structuredEntry?.branch ?? detectBranch(input.commandEvidence),
      commitSha: structuredEntry?.commitSha ?? detectCommit(input.commandEvidence),
      exitCode: structuredEntry?.exitCode ?? detectExitCode(input.commandEvidence),
      output: structuredEntry ? renderStructuredCommandOutput(structuredEntry) : input.commandEvidence,
      source,
      expectedRepo: input.expectedRepo ?? input.targetRepoPath,
      expectedCwd: input.expectedCwd ?? input.targetRepoPath,
      expectedBranch: input.expectedBranch,
      expectedCommitSha: input.expectedCommitSha,
      claimType
    }),
    command
  };
}

function selectStructuredCommandEvidenceEntry(
  input: ProjectControlProofStackInput,
  claimType: CommandEvidenceClaimType
): ProjectControlCommandEvidenceEntry | undefined {
  const entries = input.commandEvidenceEntries ?? [];
  if (entries.length === 0) return undefined;

  const classified = entries.map((entry) => ({
    entry,
    result: classifyCommandEvidence({
      command: entry.command,
      cwd: entry.cwd,
      repo: entry.repo,
      branch: entry.branch,
      commitSha: entry.commitSha,
      exitCode: entry.exitCode,
      output: renderStructuredCommandOutput(entry),
      source: entry.source,
      expectedRepo: input.expectedRepo ?? input.targetRepoPath,
      expectedCwd: input.expectedCwd ?? input.targetRepoPath,
      expectedBranch: input.expectedBranch,
      expectedCommitSha: input.expectedCommitSha,
      claimType
    })
  }));

  return (
    classified.find(({ result }) => result.proofStrength === "strong_local_proof")?.entry ??
    classified.find(({ result }) => result.proofStrength !== "not_relevant_to_claim")?.entry ??
    entries[0]
  );
}

function renderStructuredCommandOutput(entry: NonNullable<ProjectControlProofStackInput["commandEvidenceEntries"]>[number]): string {
  return [
    entry.cwd ? `cwd=${entry.cwd}` : "",
    entry.repo ? `repo=${entry.repo}` : "",
    entry.branch ? `branch=${entry.branch}` : "",
    entry.commitSha ? `commitSha=${entry.commitSha}` : "",
    `$ ${entry.command}`,
    entry.exitCode !== undefined && entry.exitCode !== null ? `Exit code: ${entry.exitCode}` : "",
    entry.startedAt ? `startedAt=${entry.startedAt}` : "",
    entry.finishedAt ? `finishedAt=${entry.finishedAt}` : "",
    entry.stdout,
    entry.stderr
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveChangedFiles(input: ProjectControlProofStackInput, combined: string): DiffChangedFileInput[] {
  if (input.changedFiles !== undefined && input.changedFiles.length > 0) {
    return input.changedFiles.map((file) => ({
      path: file.newPath ?? file.path,
      changeType: file.changeType,
      fileRole: file.fileRole,
      reason: file.patch ? "Structured changed file with patch evidence." : undefined
    }));
  }

  if (input.unifiedDiff) {
    const parsed = parseUnifiedDiff(input.unifiedDiff);
    if (parsed.length > 0) {
      return parsed.map((file) => ({
        path: file.path,
        changeType: file.changeType,
        fileRole: file.fileRole,
        oldPath: file.oldPath,
        newPath: file.newPath,
        patch: file.patch,
        addedLines: file.addedLines,
        deletedLines: file.deletedLines,
        reason: file.modeChanged
          ? "Parsed from unified diff with mode change."
          : file.isBinary
            ? "Parsed from unified diff binary patch."
            : "Parsed from unified diff."
      }));
    }
  }

  if (input.changedFiles !== undefined) return [];

  return detectChangedFiles(combined);
}

function deriveClaims(text: string): DerivedClaim[] {
  return dedupeClaims(decomposeClaimsFromReport(text));
}

function detectChangedFiles(text: string): DiffChangedFileInput[] {
  const filePattern =
    /\b(?:src|tests|docs|fixtures|config|pipeline|tools|projects|mobile|evals|modes|scripts|dist)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+\b/g;
  const matches = Array.from(text.matchAll(filePattern)).map((match) => match[0]);
  return dedupe(matches).map((filePath) => ({
    path: filePath,
    changeType: "modified" as const
  }));
}

function detectCommand(text: string): string | undefined {
  const shellMatch = text.match(/\$\s*([^\n]+)/);
  if (shellMatch) return shellMatch[1].trim();
  const npmMatch = text.match(/\b(npm run [A-Za-z0-9:_-]+|npm test|npm ci|python3?\s+[^\n]+|pytest\b[^\n]*|go test[^\n]*|cargo test[^\n]*|cargo check[^\n]*|pwsh\s+[^\n]+)/i);
  return npmMatch?.[1]?.trim();
}

function detectCommandSource(commandEvidence: string, codexReport: string): CommandEvidenceSource {
  if (/human-pasted|human pasted/i.test(commandEvidence)) return "human_pasted_command_output";
  if (/codex says|codex reported|codex report/i.test(codexReport) && !/\$\s*/.test(commandEvidence)) {
    return "codex_reported_command_output";
  }
  if (/workflow|github actions|gh run|ci/i.test(commandEvidence)) return "ci_workflow_output";
  if (!/\$\s*|exit code|passed|failed|run-\d{4}|runs\/\d{4}/i.test(commandEvidence)) return "non_execution_evidence";
  return "local_stax_command_output";
}

function detectCommandClaimType(text: string): CommandEvidenceClaimType {
  const claims = decomposeClaimsFromReport(text).map((claim) => claim.claimType);
  if (claims.includes("release_deploy")) return "release_ready";
  if (/\b(?:build passed|build succeeded|build completed|compiled successfully)\b/i.test(text)) return "build_passed";
  if (/\btypecheck\b/i.test(text)) return "typecheck_passed";
  if (/\blint\b/i.test(text)) return "lint_passed";
  if (claims.includes("test") || claims.includes("eval")) return "tests_passed";
  if (
    claims.some((claim) =>
      [
        "implementation",
        "behavior",
        "visual",
        "data",
        "security",
        "config_policy",
        "dependency",
        "migration",
        "protocol_compliance",
        "performance",
        "accessibility",
        "memory_promotion"
      ].includes(claim)
    )
  ) {
    return "behavior";
  }
  return "unspecified";
}

function deriveProofItems(
  claim: DerivedClaim,
  changedFiles: DiffChangedFileInput[],
  sourceChangedFiles: ProjectControlChangedFile[] | undefined,
  visualEvidence: ProjectControlVisualEvidence[] | undefined,
  dataProofArtifacts: ProjectControlDataProofArtifact[] | undefined,
  releaseProofArtifacts: ProjectControlReleaseProofArtifact[] | undefined,
  commandInsight: CommandInsight | undefined,
  commandEvidenceEntries: ProjectControlCommandEvidenceEntry[] | undefined,
  combined: string
): ClaimProofItem[] {
  const files = dedupe(changedFiles.map((file) => file.path));
  const hasSource = files.some((file) => file.startsWith("src/"));
  const hasTests = files.some((file) => file.startsWith("tests/"));
  const hasDocs = files.some((file) => file.startsWith("docs/"));
  const hasVisual = files.some((file) => /\.(css|scss|sass|less)$/i.test(file) || file.includes("/workspace/"));
  const strongCommand = commandInsight?.proofStrength === "strong_local_proof";
  const weakCommand = commandInsight && commandInsight.proofStrength !== "strong_local_proof";
  const proof: ClaimProofItem[] = [];
  const testQuality = evaluateTestQuality(sourceChangedFiles, claim.claimType);
  const visualQuality = evaluateVisualProof(visualEvidence, files, claim.claimType);
  const dataQuality = evaluateDataProof(dataProofArtifacts, claim.claimType, combined);
  const releaseQuality = evaluateReleaseProof(releaseProofArtifacts, claim.claimType, combined);
  const hasBehaviorCommand = hasStrongBehaviorCommandEvidence(commandEvidenceEntries, commandInsight);
  const hasExportRegenerationProof = /\b(?:build|export regenerated|regenerated export)\b/i.test(combined);
  const hasLiveTargetProof = /\b(?:target sheet|TestFlight|App Store|production|staging|credential|config\/sheets_sync\.json|target validated|target environment verified|live target fetch|target fetch|live target checked)\b/i.test(combined);
  const hasSecurityAuditProof =
    hasStrongCommandEvidenceMatching(commandEvidenceEntries, /\baudit:security\b/i) ||
    (strongCommand && /\baudit:security\b|\bsecurity audit passed\b/i.test(combined));

  const push = (proofType: ClaimProofItem["proofType"], strength: ClaimProofItem["strength"], description: string) => {
    proof.push({ proofType, strength, description });
  };

  switch (claim.claimType) {
    case "implementation":
      push("source_diff", hasSource ? "strong" : hasDocs ? "weak" : "missing", hasSource ? "Source files changed." : hasDocs ? "Only docs paths detected." : "No source diff detected.");
      push(
        "behavior_test",
        hasTests
          ? testQuality
            ? testQuality.supportsBehaviorProof
              ? "strong"
              : testQuality.supportsTestClaim
                ? "weak"
                : "missing"
            : "strong"
          : hasBehaviorCommand
            ? "strong"
          : "missing",
        hasTests
          ? testQuality
            ? renderTestQualityDescription(testQuality, "behavior")
            : "Test files detected."
          : hasBehaviorCommand
            ? "Verified behavior/e2e command evidence detected."
          : "No behavior test evidence detected."
      );
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      break;
    case "test":
      push(
        "test_diff",
        hasTests
          ? testQuality
            ? testQuality.supportsTestClaim
              ? testQuality.verdict === "accept"
                ? "strong"
                : "weak"
              : "missing"
            : "strong"
          : "missing",
        hasTests
          ? testQuality
            ? renderTestQualityDescription(testQuality, "test")
            : "Test files detected."
          : "No test diff detected."
      );
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      break;
    case "behavior":
      push(
        "behavior_test",
        hasTests
          ? testQuality
            ? testQuality.supportsBehaviorProof
              ? "strong"
              : testQuality.supportsTestClaim
                ? "weak"
                : "missing"
            : "strong"
          : hasBehaviorCommand
            ? "strong"
          : "missing",
        hasTests
          ? testQuality
            ? renderTestQualityDescription(testQuality, "behavior")
            : "Behavior test evidence detected."
          : hasBehaviorCommand
            ? "Verified behavior/e2e command evidence detected."
          : "No behavior test evidence detected."
      );
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      break;
    case "visual":
      push(
        "rendered_visual_proof",
        visualQuality
          ? visualQuality.supportsVisualClaim
            ? "strong"
            : visualQuality.verdict === "provisional"
              ? "weak"
              : "missing"
          : /\b(screenshot|rendered preview|visual checklist|playwright screenshot)\b/i.test(combined)
            ? "strong"
            : hasVisual
              ? "weak"
              : "missing",
        visualQuality
          ? renderVisualQualityDescription(visualQuality)
          : /\b(screenshot|rendered preview|visual checklist|playwright screenshot)\b/i.test(combined)
            ? "Rendered visual proof supplied."
            : hasVisual
              ? "Visual/style files detected without rendered proof."
              : "No rendered visual proof detected."
      );
      break;
    case "eval":
      push("eval_command_evidence", /\beval\b|\bredteam\b|\bregression\b/i.test(combined) && strongCommand ? "strong" : /\beval\b|\bredteam\b|\bregression\b/i.test(combined) ? "weak" : "missing", /\beval\b|\bredteam\b|\bregression\b/i.test(combined) ? "Eval command evidence mentioned." : "No eval command evidence detected.");
      break;
    case "data":
      push(
        "data_validation",
        dataQuality
          ? dataQuality.supportsDataClaim || dataQuality.findings.some((finding) => finding.id === "validation_present")
            ? dataQuality.verdict === "accept"
              ? "strong"
              : "weak"
            : "missing"
          : /\bvalidate-dataset|validate-canonical|validation passed\b/i.test(combined)
            ? "strong"
            : "missing",
        dataQuality
          ? renderDataQualityDescription(dataQuality)
          : /\bvalidate-dataset|validate-canonical|validation passed\b/i.test(combined)
            ? "Data validation evidence detected."
            : "No data validation evidence detected."
      );
      push(
        "row_count_diff",
        dataQuality
          ? dataQuality.supportsDataClaim || dataQuality.findings.some((finding) => finding.id === "row_count_present")
            ? dataQuality.verdict === "accept"
              ? "strong"
              : "weak"
            : "missing"
          : /\brow-count|row count|duplicate|unknown-field|unknown field|blank rates\b/i.test(combined)
            ? "strong"
            : "missing",
        dataQuality
          ? renderDataQualityDescription(dataQuality)
          : /\brow-count|row count|duplicate|unknown-field|unknown field|blank rates\b/i.test(combined)
            ? "Row-count or QA diff evidence detected."
            : "No row-count/diff evidence detected."
      );
      push(
        "dry_run_artifact",
        dataQuality
          ? dataQuality.supportsDataClaim || dataQuality.findings.some((finding) => finding.id === "dry_run_present")
            ? dataQuality.verdict === "accept"
              ? "strong"
              : "weak"
            : "missing"
          : /\bdry-run|dry run|candidate diff\b/i.test(combined)
            ? "strong"
            : "missing",
        dataQuality
          ? renderDataQualityDescription(dataQuality)
          : /\bdry-run|dry run|candidate diff\b/i.test(combined)
            ? "Dry-run artifact detected."
            : "No dry-run artifact detected."
      );
      break;
    case "release_deploy":
      push(
        "build_proof",
        releaseQuality
          ? releaseQuality.supportsReleaseClaim || releaseQuality.findings.some((finding) => finding.id === "build_proof_present")
            ? releaseQuality.verdict === "accept"
              ? "strong"
              : "weak"
            : "missing"
          : hasExportRegenerationProof && strongCommand
            ? "strong"
            : hasExportRegenerationProof
              ? "weak"
              : "missing",
        releaseQuality
          ? renderReleaseQualityDescription(releaseQuality)
          : hasExportRegenerationProof
            ? "Build/export evidence mentioned."
            : "No build proof detected."
      );
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      push(
        "target_environment_proof",
        releaseQuality
          ? releaseQuality.supportsReleaseClaim || releaseQuality.findings.some((finding) => finding.id === "target_environment_present")
            ? releaseQuality.verdict === "accept"
              ? "strong"
              : "weak"
            : "missing"
          : hasLiveTargetProof && strongCommand
            ? "strong"
            : hasLiveTargetProof
              ? "weak"
            : "missing",
        releaseQuality
          ? renderReleaseQualityDescription(releaseQuality)
          : hasLiveTargetProof
            ? "Target environment proof mentioned."
            : "No target environment proof detected."
      );
      push(
        "rollback_plan",
        releaseQuality
          ? releaseQuality.supportsReleaseClaim || releaseQuality.findings.some((finding) => finding.id === "rollback_plan_present")
            ? releaseQuality.verdict === "accept"
              ? "strong"
              : "weak"
            : "missing"
          : /\brollback\b|\brevert\b/i.test(combined)
            ? "strong"
            : "missing",
        releaseQuality
          ? renderReleaseQualityDescription(releaseQuality)
          : /\brollback\b|\brevert\b/i.test(combined)
            ? "Rollback/revert plan mentioned."
            : "No rollback plan detected."
      );
      break;
    case "memory_promotion":
      push("human_approval", /\bapprovedBy|approvalReason|approved project memory|pending review\b/i.test(combined) ? "weak" : "missing", /\bapprovedBy|approvalReason|approved project memory|pending review\b/i.test(combined) ? "Approval lane mentioned but not proven." : "No human approval proof detected.");
      push("source_run_reference", /\brun-\d{4}|runs\/\d{4}\b/i.test(combined) ? "strong" : "missing", /\brun-\d{4}|runs\/\d{4}\b/i.test(combined) ? "Source run reference detected." : "No source run reference detected.");
      break;
    case "security":
      push(
        "security_test",
        hasSecurityAuditProof
          ? "strong"
          : /\bsecurity test|prompt injection|secret scan|vulnerability\b/i.test(combined)
            ? "weak"
            : "missing",
        hasSecurityAuditProof
          ? "Verified audit:security evidence detected."
          : /\bsecurity test|prompt injection|secret scan|vulnerability\b/i.test(combined)
            ? "Security language present but not strongly proven."
            : "No security test detected."
      );
      push(
        "secret_scan",
        hasSecurityAuditProof
          ? "strong"
          : /\bsecret scan|token scan|private key|secret handling\b/i.test(combined)
            ? "weak"
            : "missing",
        hasSecurityAuditProof
          ? "Verified audit:security secret-pattern scan detected."
          : /\bsecret scan|token scan|private key|secret handling\b/i.test(combined)
            ? "Secret-scan language present but not strongly proven."
            : "No secret-scan proof detected."
      );
      break;
    case "config_policy":
      push("config_diff", files.some((file) => /config|package\.json|tsconfig|eslint|playwright\.config/i.test(file)) ? "strong" : "missing", files.some((file) => /config|package\.json|tsconfig|eslint|playwright\.config/i.test(file)) ? "Config or policy diff detected." : "No config or policy diff detected.");
      push("human_policy_approval", /\bapproved by|human approval|policy approval\b/i.test(combined) ? "strong" : "missing", /\bapproved by|human approval|policy approval\b/i.test(combined) ? "Human policy approval detected." : "No human policy approval detected.");
      break;
    case "dependency":
      push("dependency_inspection", /\bnpm ls\b|\bpnpm list\b|\byarn why\b|\bpip show\b|\bcargo tree\b/i.test(combined) ? "strong" : "missing", /\bnpm ls\b|\bpnpm list\b|\byarn why\b|\bpip show\b|\bcargo tree\b/i.test(combined) ? "Dependency inspection evidence detected." : "No dependency inspection evidence detected.");
      push("dependency_build_proof", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Command evidence after dependency change is present." : weakCommand ? "Only weak dependency command evidence is present." : "No dependency build/test proof detected.");
      break;
    case "migration":
      push("migration_diff", files.some((file) => /migration|schema/i.test(file)) ? "strong" : "missing", files.some((file) => /migration|schema/i.test(file)) ? "Migration diff detected." : "No migration diff detected.");
      push("migration_apply_proof", /\bmigrate\b|\balembic upgrade\b|\bdb push\b/i.test(combined) && strongCommand ? "strong" : /\bmigrate\b|\balembic upgrade\b|\bdb push\b/i.test(combined) ? "weak" : "missing", /\bmigrate\b|\balembic upgrade\b|\bdb push\b/i.test(combined) ? "Migration apply evidence mentioned." : "No migration apply proof detected.");
      push("migration_rollback_proof", /\brollback\b|\brevert\b|\bdowngrade\b/i.test(combined) ? "strong" : "missing", /\brollback\b|\brevert\b|\bdowngrade\b/i.test(combined) ? "Migration rollback proof mentioned." : "No migration rollback proof detected.");
      break;
    case "protocol_compliance":
      push("protocol_acknowledgement", /\bSTAX_ACK\b/i.test(combined) ? "strong" : "missing", /\bSTAX_ACK\b/i.test(combined) ? "STAX acknowledgement detected." : "No STAX acknowledgement detected.");
      push("codex_report_contract", /\bFiles changed\b[\s\S]*\bCommands run\b[\s\S]*\bWhat is verified\b[\s\S]*\bWhat is unverified\b[\s\S]*\bRisks\b/i.test(combined) ? "strong" : "missing", "Codex report contract sections checked.");
      break;
    case "performance":
      push("performance_benchmark", /\bbenchmark\b|\blatency\b|\bms\b|\bops\/s\b/i.test(combined) ? "strong" : "missing", /\bbenchmark\b|\blatency\b|\bms\b|\bops\/s\b/i.test(combined) ? "Performance benchmark evidence detected." : "No performance benchmark evidence detected.");
      push("performance_baseline", /\bbaseline\b|\bbefore\/after\b|\bbefore after\b/i.test(combined) ? "strong" : "missing", /\bbaseline\b|\bbefore\/after\b|\bbefore after\b/i.test(combined) ? "Performance baseline comparison detected." : "No performance baseline detected.");
      break;
    case "accessibility":
      push("accessibility_audit", /\baxe\b|\ba11y\b|\baccessibility audit\b/i.test(combined) ? "strong" : "missing", /\baxe\b|\ba11y\b|\baccessibility audit\b/i.test(combined) ? "Accessibility audit evidence detected." : "No accessibility audit detected.");
      push("ui_flow_evidence", /\bscreenshot\b|\bplaywright\b|\bmanual check\b|\bscreen reader\b/i.test(combined) ? "strong" : "missing", /\bscreenshot\b|\bplaywright\b|\bmanual check\b|\bscreen reader\b/i.test(combined) ? "UI flow evidence detected." : "No UI flow evidence detected.");
      break;
  }

  return proof;
}

function claimToDiffClaimType(claimType: ClaimProofClaimType): DiffAuditClaimInput["claimType"] | undefined {
  if (claimType === "release_deploy") return "release";
  if (
    claimType === "implementation" ||
    claimType === "test" ||
    claimType === "behavior" ||
    claimType === "visual" ||
    claimType === "data" ||
    claimType === "memory_promotion" ||
    claimType === "security"
  ) {
    return claimType;
  }
  return undefined;
}

function deriveScopePaths(changedFiles: DiffChangedFileInput[]): string[] {
  return dedupe(changedFiles.map((file) => {
    const parts = file.path.split("/");
    return parts.length > 1 ? `${parts[0]}/${parts[1]}` : file.path;
  }));
}

function hasStrongCommandEvidenceMatching(
  entries: ProjectControlCommandEvidenceEntry[] | undefined,
  commandPattern: RegExp
): boolean {
  return (entries ?? []).some((entry) =>
    entry.source === "local_stax_command_output" &&
    entry.exitCode === 0 &&
    commandPattern.test(entry.command)
  );
}

function hasStrongBehaviorCommandEvidence(
  entries: ProjectControlCommandEvidenceEntry[] | undefined,
  commandInsight: CommandInsight | undefined
): boolean {
  const commands = [
    ...(entries ?? [])
      .filter((entry) => entry.source === "local_stax_command_output" && entry.exitCode === 0)
      .map((entry) => entry.command),
    commandInsight?.proofStrength === "strong_local_proof" ? commandInsight.command : ""
  ];

  return commands.some((command) =>
    /\b(?:test|e2e|playwright|cypress|vitest|tsx\s+--test|node\s+--test|pytest|rspec|phpunit|verify)\b/i.test(command)
      && !/\b(?:typecheck|tsc\s+--noEmit|lint|format|build:studio|build)\b/i.test(command)
  );
}

function evaluateTestQuality(
  changedFiles: ProjectControlChangedFile[] | undefined,
  claimType: ClaimProofClaimType
) {
  if (!["implementation", "test", "behavior"].includes(claimType)) return undefined;
  const testFile = changedFiles?.find((file) => file.path.startsWith("tests/") && typeof file.patch === "string" && file.patch.trim());
  if (!testFile || typeof testFile.patch !== "string" || !testFile.patch.trim()) return undefined;
  return analyzeTestQuality({
    filePath: testFile.path,
    patch: testFile.patch,
    intendedClaim: claimType === "test" ? "test" : "behavior"
  });
}

function evaluateVisualProof(
  visualEvidence: ProjectControlVisualEvidence[] | undefined,
  files: string[],
  claimType: ClaimProofClaimType
) {
  if (claimType !== "visual") return undefined;
  const primary = visualEvidence?.[0];
  if (!primary) return undefined;
  const checklistItems = Array.isArray(primary.checklistItems) ? primary.checklistItems : [];
  return analyzeVisualProof({
    task: primary.description,
    changedFiles: files,
    description: primary.description,
    source: primary.source,
    capturedAt: primary.capturedAt,
    expectedPage: /sports wellness/i.test(primary.description) ? "Sports Wellness" : undefined,
    checklistItems: checklistItems.length > 0 ? checklistItems : extractChecklistItems(primary.description)
  });
}

function renderVisualQualityDescription(result: ReturnType<typeof analyzeVisualProof>): string {
  const topFindings = result.findings.slice(0, 2).map((finding) => finding.id).join(", ");
  return `Visual proof quality is ${result.verdict} (${topFindings}).`;
}

function evaluateDataProof(
  dataProofArtifacts: ProjectControlDataProofArtifact[] | undefined,
  claimType: ClaimProofClaimType,
  combined: string
) {
  if (claimType !== "data") return undefined;
  const primary = dataProofArtifacts?.[0];
  if (!primary) return undefined;
  return analyzeDataPipelineProof({
    task: combined,
    ...primary
  });
}

function renderDataQualityDescription(result: ReturnType<typeof analyzeDataPipelineProof>): string {
  const topFindings = result.findings.slice(0, 2).map((finding) => finding.id).join(", ");
  return `Data proof quality is ${result.verdict} (${topFindings}).`;
}

function evaluateReleaseProof(
  releaseProofArtifacts: ProjectControlReleaseProofArtifact[] | undefined,
  claimType: ClaimProofClaimType,
  combined: string
) {
  if (claimType !== "release_deploy") return undefined;
  const primary = releaseProofArtifacts?.[0];
  if (!primary) return undefined;
  return analyzeReleaseGate({
    task: combined,
    ...primary
  });
}

function renderReleaseQualityDescription(result: ReturnType<typeof analyzeReleaseGate>): string {
  const topFindings = result.findings.slice(0, 2).map((finding) => finding.id).join(", ");
  return `Release proof quality is ${result.verdict} (${topFindings}).`;
}

function extractChecklistItems(text: string): string[] {
  const items: string[] = [];
  if (/\btext fit\b/i.test(text)) items.push("text fit");
  if (/\bsymmetry\b|\bborder symmetry\b/i.test(text)) items.push("symmetry");
  if (/\bcheckmark containment\b|\bicon containment\b|\bcontainment\b/i.test(text)) items.push("checkmark containment");
  if (/\bmobile\b|\bresponsive\b/i.test(text)) items.push("mobile responsive");
  if (/\baccessibility\b|\ba11y\b|\baxe\b/i.test(text)) items.push("accessibility");
  return items;
}

function renderTestQualityDescription(
  result: ReturnType<typeof analyzeTestQuality>,
  lane: "test" | "behavior"
): string {
  const topFindings = result.findings.slice(0, 2).map((finding) => finding.id).join(", ");
  return `${lane === "test" ? "Test diff" : "Behavior test"} quality is ${result.verdict} (${topFindings}).`;
}

function detectCwd(text: string): string | undefined {
  return text.match(/\bcwd[=:]\s*([^\n]+)/i)?.[1]?.trim();
}

function detectRepo(text: string): string | undefined {
  return text.match(/\/Users\/deanguedo\/Documents\/GitHub\/[A-Za-z0-9_.-]+/)?.[0];
}

function detectBranch(text: string): string | undefined {
  return text.match(/\bbranch[=:]?\s*([A-Za-z0-9_./-]+)/i)?.[1]?.trim();
}

function detectCommit(text: string): string | undefined {
  return text.match(/\b(?:commit(?:sha)?|sha)[=:]?\s*([a-f0-9]{7,40})/i)?.[1]?.trim();
}

function detectExitCode(text: string): number | null | undefined {
  const raw = text.match(/\bexit code[=:]?\s*(-?\d+)/i)?.[1];
  return raw ? Number(raw) : undefined;
}

function detectSha(text: string, kind: "base" | "head"): string | undefined {
  const pattern = kind === "base" ? /\bbaseSha[=:]?\s*([a-f0-9]{7,40})/i : /\bheadSha[=:]?\s*([a-f0-9]{7,40})/i;
  return text.match(pattern)?.[1]?.trim();
}

function repoLabel(input: ProjectControlProofStackInput): string {
  return input.targetRepoPath ?? input.expectedRepo ?? detectRepo([input.repoEvidence, input.commandEvidence].join("\n")) ?? "unknown-repo";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeClaims(values: DerivedClaim[]): DerivedClaim[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.claimType}:${value.claim}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
