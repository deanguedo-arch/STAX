import { decomposeClaimsFromReport, mapClaimToProof, requiredProofForClaim } from "../claims/ClaimProofMapping.js";
import type { ClaimProofClaimType, ClaimProofItem } from "../claims/ClaimProofMappingSchemas.js";
import { auditDiffEvidence } from "../diffAudit/DiffAudit.js";
import type { DiffAuditInput } from "../diffAudit/DiffAuditSchemas.js";
import { parseUnifiedDiff } from "../diffAudit/UnifiedDiffParser.js";
import { classifyCommandEvidence } from "../evidence/CommandEvidenceIntelligence.js";
import type { CommandEvidenceClaimType, CommandEvidenceSource } from "../evidence/CommandEvidenceIntelligenceSchemas.js";
import type {
  ProjectControlChangedFile,
  ProjectControlCommandEvidenceEntry,
  ProjectControlHumanApproval,
  ProjectControlVisualEvidence
} from "./ProjectControlEvidencePacket.js";

export type ProjectControlProofStackInput = {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
  changedFiles?: ProjectControlChangedFile[];
  unifiedDiff?: string;
  commandEvidenceEntries?: ProjectControlCommandEvidenceEntry[];
  visualEvidence?: ProjectControlVisualEvidence[];
  humanApproval?: ProjectControlHumanApproval[];
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

  const derivedClaims = deriveClaims(combined);
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
    const suppliedProof = deriveProofItems(claim, changedFiles, commandInsight, combined);
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
  const structuredEntry = input.commandEvidenceEntries?.[0];
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
      output: input.commandEvidence,
      source,
      expectedRepo: input.expectedRepo ?? input.targetRepoPath,
      expectedCwd: input.expectedCwd ?? input.targetRepoPath,
      expectedBranch: input.expectedBranch,
      expectedCommitSha: input.expectedCommitSha,
      claimType: detectCommandClaimType([input.task, input.codexReport].join("\n"))
    }),
    command
  };
}

function resolveChangedFiles(input: ProjectControlProofStackInput, combined: string): DiffChangedFileInput[] {
  if (input.changedFiles && input.changedFiles.length > 0) {
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
        reason: file.modeChanged
          ? "Parsed from unified diff with mode change."
          : file.isBinary
            ? "Parsed from unified diff binary patch."
            : "Parsed from unified diff."
      }));
    }
  }

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
  if (/\btests? passed\b/i.test(text)) return "tests_passed";
  if (/\bbuild\b/i.test(text)) return "build_passed";
  if (/\btypecheck\b/i.test(text)) return "typecheck_passed";
  if (/\blint\b/i.test(text)) return "lint_passed";
  if (/\brelease\b|\bdeploy\b|\bpublish\b|\bsync\b/i.test(text)) return "release_ready";
  if (/\bbehavior\b|\bworks\b|\bready\b|\bverified\b/i.test(text)) return "behavior";
  return "unspecified";
}

function deriveProofItems(
  claim: DerivedClaim,
  changedFiles: DiffChangedFileInput[],
  commandInsight: CommandInsight | undefined,
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

  const push = (proofType: ClaimProofItem["proofType"], strength: ClaimProofItem["strength"], description: string) => {
    proof.push({ proofType, strength, description });
  };

  switch (claim.claimType) {
    case "implementation":
      push("source_diff", hasSource ? "strong" : hasDocs ? "weak" : "missing", hasSource ? "Source files changed." : hasDocs ? "Only docs paths detected." : "No source diff detected.");
      push("behavior_test", hasTests ? "strong" : "missing", hasTests ? "Test files detected." : "No behavior test evidence detected.");
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      break;
    case "test":
      push("test_diff", hasTests ? "strong" : "missing", hasTests ? "Test files detected." : "No test diff detected.");
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      break;
    case "behavior":
      push("behavior_test", hasTests ? "strong" : "missing", hasTests ? "Behavior test evidence detected." : "No behavior test evidence detected.");
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      break;
    case "visual":
      push("rendered_visual_proof", /\b(screenshot|rendered preview|visual checklist|playwright screenshot)\b/i.test(combined) ? "strong" : hasVisual ? "weak" : "missing", /\b(screenshot|rendered preview|visual checklist|playwright screenshot)\b/i.test(combined) ? "Rendered visual proof supplied." : hasVisual ? "Visual/style files detected without rendered proof." : "No rendered visual proof detected.");
      break;
    case "eval":
      push("eval_command_evidence", /\beval\b|\bredteam\b|\bregression\b/i.test(combined) && strongCommand ? "strong" : /\beval\b|\bredteam\b|\bregression\b/i.test(combined) ? "weak" : "missing", /\beval\b|\bredteam\b|\bregression\b/i.test(combined) ? "Eval command evidence mentioned." : "No eval command evidence detected.");
      break;
    case "data":
      push("data_validation", /\bvalidate-dataset|validate-canonical|validation passed\b/i.test(combined) ? "strong" : "missing", /\bvalidate-dataset|validate-canonical|validation passed\b/i.test(combined) ? "Data validation evidence detected." : "No data validation evidence detected.");
      push("row_count_diff", /\brow-count|row count|duplicate|unknown-field|unknown field|blank rates\b/i.test(combined) ? "strong" : "missing", /\brow-count|row count|duplicate|unknown-field|unknown field|blank rates\b/i.test(combined) ? "Row-count or QA diff evidence detected." : "No row-count/diff evidence detected.");
      push("dry_run_artifact", /\bdry-run|dry run|candidate diff\b/i.test(combined) ? "strong" : "missing", /\bdry-run|dry run|candidate diff\b/i.test(combined) ? "Dry-run artifact detected." : "No dry-run artifact detected.");
      break;
    case "release_deploy":
      push("build_proof", /\bbuild\b/i.test(combined) && strongCommand ? "strong" : /\bbuild\b/i.test(combined) ? "weak" : "missing", /\bbuild\b/i.test(combined) ? "Build-related evidence mentioned." : "No build proof detected.");
      push("command_evidence_after_diff", strongCommand ? "strong" : weakCommand ? "weak" : "missing", strongCommand ? "Strong local command evidence present." : weakCommand ? "Only weak/partial command evidence present." : "No command evidence after diff.");
      push("target_environment_proof", /\btarget sheet|TestFlight|App Store|production|staging|credential|config\/sheets_sync\.json\b/i.test(combined) ? "weak" : "missing", /\btarget sheet|TestFlight|App Store|production|staging|credential|config\/sheets_sync\.json\b/i.test(combined) ? "Target environment mentioned but not fully proven." : "No target environment proof detected.");
      push("rollback_plan", /\brollback\b|\brevert\b/i.test(combined) ? "strong" : "missing", /\brollback\b|\brevert\b/i.test(combined) ? "Rollback/revert plan mentioned." : "No rollback plan detected.");
      break;
    case "memory_promotion":
      push("human_approval", /\bapprovedBy|approvalReason|approved project memory|pending review\b/i.test(combined) ? "weak" : "missing", /\bapprovedBy|approvalReason|approved project memory|pending review\b/i.test(combined) ? "Approval lane mentioned but not proven." : "No human approval proof detected.");
      push("source_run_reference", /\brun-\d{4}|runs\/\d{4}\b/i.test(combined) ? "strong" : "missing", /\brun-\d{4}|runs\/\d{4}\b/i.test(combined) ? "Source run reference detected." : "No source run reference detected.");
      break;
    case "security":
      push("security_test", /\bsecurity test|prompt injection|secret scan|vulnerability\b/i.test(combined) ? "weak" : "missing", /\bsecurity test|prompt injection|secret scan|vulnerability\b/i.test(combined) ? "Security language present but not strongly proven." : "No security test detected.");
      push("secret_scan", /\bsecret scan|token scan|private key|secret handling\b/i.test(combined) ? "weak" : "missing", /\bsecret scan|token scan|private key|secret handling\b/i.test(combined) ? "Secret-scan language present but not strongly proven." : "No secret-scan proof detected.");
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
