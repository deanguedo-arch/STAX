import path from "node:path";
import { readTextIfExists, sidecarDir, validateRepoPath } from "./SidecarRepo.js";
import { checkTurnCompliance, type TurnComplianceMode } from "./TurnCompliance.js";

export type ProtocolStatus = "ok" | "warning" | "failure";
export type ProtocolFindingSeverity = "warning" | "human_review" | "reject";

export type ProtocolComplianceFinding = {
  id: string;
  severity: ProtocolFindingSeverity;
  message: string;
};

export type ProtocolComplianceResult = {
  schemaVersion: "stax-protocol-compliance-v1";
  generatedAt: string;
  mode: TurnComplianceMode;
  status: ProtocolStatus;
  acknowledgedTurnContract: boolean;
  codexReportPresent: boolean;
  requiredSectionsPresent: string[];
  missingRequiredSections: string[];
  findings: ProtocolComplianceFinding[];
  acknowledgement?: string;
  contractTurnId?: string;
};

export type VerifyProtocolComplianceOptions = {
  repoPath: string;
  codexReportText?: string;
  mode?: TurnComplianceMode;
  codexClaimsCompletion?: boolean;
  hasDiff?: boolean;
  now?: Date;
};

const REQUIRED_REPORT_SECTIONS = [
  "STAX acknowledgement",
  "Objective",
  "Files changed",
  "Tests added",
  "Commands run",
  "Command output summary with exit codes",
  "What is verified",
  "What is weak/provisional",
  "What is unverified",
  "Risks",
  "One next action"
] as const;

export async function verifyProtocolCompliance(
  options: VerifyProtocolComplianceOptions
): Promise<ProtocolComplianceResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  const mode = options.mode ?? "normal";
  const codexReportText =
    options.codexReportText ?? (await readTextIfExists(path.join(sidecarDir(repoPath), "codex-report.md")));
  const reportPresent = codexReportText.trim().length > 0;
  const codexClaimsCompletion =
    options.codexClaimsCompletion ?? codexCompletionClaim(codexReportText);
  const sectionSummary = reportSectionSummary(codexReportText);

  if (mode === "manual") {
    return {
      schemaVersion: "stax-protocol-compliance-v1",
      generatedAt: (options.now ?? new Date()).toISOString(),
      mode,
      status: "ok",
      acknowledgedTurnContract: false,
      codexReportPresent: reportPresent,
      requiredSectionsPresent: sectionSummary.present,
      missingRequiredSections: sectionSummary.missing,
      findings: []
    };
  }

  const turnCompliance = await checkTurnCompliance({
    repoPath,
    codexReportText,
    mode,
    codexClaimsCompletion,
    hasDiff: options.hasDiff,
    skipReportMtime: options.codexReportText !== undefined
  });
  const findings: ProtocolComplianceFinding[] = [];

  if (!reportPresent) {
    findings.push({
      id: "codex_report_missing",
      severity: options.hasDiff ? "reject" : "warning",
      message: ".stax/codex-report.md is missing; STAX cannot verify the agent's proof report."
    });
  }

  for (const issue of turnCompliance.issues) {
    findings.push({
      id: issueIdForTurnComplianceMessage(issue.message),
      severity: issue.severity === "reject" ? "reject" : "warning",
      message: issue.message
    });
  }

  if (reportPresent && sectionSummary.missing.length > 0) {
    findings.push({
      id: "codex_report_missing_required_sections",
      severity: codexClaimsCompletion || options.hasDiff ? "human_review" : "warning",
      message: `Codex report is missing required STAX report section(s): ${sectionSummary.missing.join(", ")}.`
    });
  }

  if (reportClaimsProtocolCompliance(codexReportText) && !turnCompliance.pass) {
    findings.push({
      id: "claimed_protocol_compliance_without_current_ack",
      severity: "reject",
      message: "Codex claimed STAX protocol compliance without proving the current STAX acknowledgement."
    });
  }

  if (codexClaimsCompletion && reportPresent && sectionSummary.present.length < REQUIRED_REPORT_SECTIONS.length) {
    findings.push({
      id: "completion_claim_not_decomposed",
      severity: "human_review",
      message: "Completion claim is not decomposed into the required STAX report fields."
    });
  }

  return {
    schemaVersion: "stax-protocol-compliance-v1",
    generatedAt: (options.now ?? new Date()).toISOString(),
    mode,
    status: protocolStatusForFindings(findings),
    acknowledgedTurnContract: turnCompliance.pass && Boolean(turnCompliance.acknowledgement),
    codexReportPresent: reportPresent,
    requiredSectionsPresent: sectionSummary.present,
    missingRequiredSections: sectionSummary.missing,
    findings: dedupeFindings(findings),
    acknowledgement: turnCompliance.acknowledgement,
    contractTurnId: turnCompliance.contract?.turnId
  };
}

export function requiredProtocolReportSections(): string[] {
  return [...REQUIRED_REPORT_SECTIONS];
}

function reportSectionSummary(report: string): { present: string[]; missing: string[] } {
  const present = REQUIRED_REPORT_SECTIONS.filter((section) => reportHasSection(report, section));
  return {
    present,
    missing: REQUIRED_REPORT_SECTIONS.filter((section) => !present.includes(section))
  };
}

function reportHasSection(report: string, section: string): boolean {
  const escaped = section.split("/").map(escapeRegex).join("[/ ]");
  const labelPattern = new RegExp(`(^|\\n)\\s*(?:[-*]\\s*)?(?:#+\\s*)?${escaped}\\s*:`, "i");
  const headingPattern = new RegExp(`(^|\\n)\\s*#+\\s*${escaped}\\s*$`, "i");
  return labelPattern.test(report) || headingPattern.test(report);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protocolStatusForFindings(findings: ProtocolComplianceFinding[]): ProtocolStatus {
  if (findings.some((finding) => finding.severity === "reject")) return "failure";
  if (findings.length > 0) return "warning";
  return "ok";
}

function codexCompletionClaim(report: string): boolean {
  return /\b(done|complete|completed|finished|ready|implemented|fixed|works|tests? passed|verified)\b/i.test(report);
}

function reportClaimsProtocolCompliance(report: string): boolean {
  return /\b(followed|read|acknowledged|complied with|used)\s+(?:the\s+)?STAX\b|\bSTAX\s+(?:protocol|contract)\b/i.test(report);
}

function issueIdForTurnComplianceMessage(message: string): string {
  if (/turn-contract\.json is missing/i.test(message)) return "turn_contract_missing";
  if (/turn-contract\.json is malformed/i.test(message)) return "turn_contract_malformed";
  if (/missing the current STAX acknowledgement/i.test(message)) return "stax_ack_missing";
  if (/stale or does not match/i.test(message)) return "stax_ack_stale";
  if (/turnId/i.test(message)) return "stax_ack_wrong_turn";
  if (/statusHash/i.test(message)) return "stax_ack_wrong_status_hash";
  if (/nextPromptHash/i.test(message)) return "stax_ack_wrong_next_prompt_hash";
  if (/Current Codex turn capture/i.test(message)) return "current_turn_capture_missing_ack";
  if (/older than the current STAX turn contract/i.test(message)) return "codex_report_older_than_turn_contract";
  return "turn_compliance_issue";
}

function dedupeFindings(findings: ProtocolComplianceFinding[]): ProtocolComplianceFinding[] {
  const seen = new Set<string>();
  const unique: ProtocolComplianceFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.id}:${finding.severity}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return unique;
}
