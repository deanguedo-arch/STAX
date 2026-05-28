import fs from "node:fs/promises";
import path from "node:path";
import { decomposeClaimsFromReport } from "../claims/ClaimProofMapping.js";
import { proofSurfacePromptHint } from "../projectControl/ProofSurfacePack.js";
import { classifyFileRole } from "../diffAudit/DiffAudit.js";
import { parseUnifiedDiff } from "../diffAudit/UnifiedDiffParser.js";
import { commandFamilyFor, type CommandEvidence } from "../evidence/CommandEvidenceStore.js";
import { EvidenceGroundingGate } from "../evidence/EvidenceGroundingGate.js";
import type { EvidenceGroundingResult, GroundedClaim } from "../evidence/EvidenceGroundingSchemas.js";
import { ProofStrengthGate } from "../evidence/ProofStrengthGate.js";
import type { ProofStrengthClaimType, ProofStrengthResult } from "../evidence/ProofStrengthSchemas.js";
import { buildProjectControlProofStack } from "../projectControl/ProjectControlProofStack.js";
import type {
  ProjectControlChangedFile,
  ProjectControlCommandEvidenceEntry,
  StructuredProjectControlEvidencePacket
} from "../projectControl/ProjectControlEvidencePacket.js";
import type { ProjectControlCardStatus } from "../projectControl/ControlCard.js";
import { validateProjectControlCardShape } from "../projectControl/ControlCard.js";
import type { RepoEvidencePack } from "../workspace/RepoEvidenceSchemas.js";
import {
  readCommandEvidenceLedgerTipFromDir,
  readCommandEvidenceLedgerFromDir,
  verifyCommandEvidenceLedger,
  type CommandEvidenceLedgerVerification
} from "./CommandEvidenceLedger.js";
import {
  verifySidecarCommandEvidence,
  type SidecarCommandEvidenceWithProvenance
} from "./CommandEvidenceVerifier.js";
import {
  displayExternalEvidencePath,
  externalCommandEvidenceStoreForRepo
} from "./ExternalCommandEvidenceStore.js";
import { writeSidecarLearningEvent } from "./SidecarLearningWriter.js";
import type { SidecarLearningEvent, SidecarLearningEventType } from "./SidecarLearningEvent.js";
import { STAX_CONFIDENCE_REPORT_RELATIVE_PATH, STAX_PROOF_REPORT_RELATIVE_PATH } from "./AttachStax.js";
import {
  verifyProtocolCompliance,
  type ProtocolComplianceFinding,
  type ProtocolComplianceResult,
  type ProtocolStatus
} from "./ProtocolComplianceVerifier.js";
import type { TurnComplianceMode } from "./TurnCompliance.js";
import { writeTurnContract, type StaxTurnContract } from "./TurnContract.js";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  readTextIfExists,
  runGit,
  sanitizeId,
  sha256,
  shortHash,
  sidecarDir,
  validateRepoPath
} from "./SidecarRepo.js";
import {
  collectWorktreeFingerprint,
  isWorktreeFingerprintExcludedPath,
  type WorktreeFingerprint
} from "./WorktreeFingerprint.js";
import {
  readVisualEvidenceForGate,
  type VerifiedVisualEvidence
} from "./VisualEvidenceCollector.js";

export type StaxGateVerdict = ProjectControlCardStatus;

export type StaxGateStatus = {
  schemaVersion: "stax-sidecar-status-v1";
  generatedAt: string;
  repo: string;
  repoPath: string;
  branch?: string;
  commitSha?: string;
  task: string;
  verdict: StaxGateVerdict;
  exitCode: 0 | 1 | 2;
  why: string;
  verified: string[];
  weak: string[];
  unverified: string[];
  risk: string[];
  oneNextAction: string;
  codexPrompt: string;
  proofStrength?: ProofStrengthResult;
  protocolStatus?: ProtocolStatus;
  protocolFailures?: ProtocolComplianceFinding[];
  protocol?: ProtocolComplianceResult;
  statusMarkdown: string;
  cardShapeIssues: string[];
  turnContract?: Pick<StaxTurnContract, "turnId" | "requiredAcknowledgement" | "statusHash" | "nextPromptHash">;
};

export type RunStaxGateOptions = {
  repoPath: string;
  writeLearningEvent?: boolean;
  now?: Date;
};

type CommandEvidenceFile = ProjectControlCommandEvidenceEntry & {
  evidenceId?: string;
  stdoutPath?: string;
  stderrPath?: string;
  warning?: string;
  worktreeBefore?: WorktreeFingerprint;
  worktreeAfter?: WorktreeFingerprint;
  stdoutHash?: string;
  stderrHash?: string;
  canonicalEvidenceHash?: string;
  collectorVersion?: string;
  evidenceStore?: "external_user_store" | "repo_local_legacy";
  externalRepoId?: string;
  externalEvidencePath?: string;
  externalLedgerPath?: string;
  repoPointerPath?: string;
};

type SidecarCommandEvidenceEntry = SidecarCommandEvidenceWithProvenance;

const STAX_PROOF_STRENGTH_SECTION_START = "<!-- STAX:proof-strength:start -->";
const STAX_PROOF_STRENGTH_SECTION_END = "<!-- STAX:proof-strength:end -->";
const STAX_ACCEPT_BOUNDARY =
  "Accept means required claims are supported by verified evidence for this repo state; STAX does not certify general code correctness.";

export async function runStaxGate(options: RunStaxGateOptions): Promise<StaxGateStatus> {
  const repoPath = await validateRepoPath(options.repoPath);
  const staxPath = sidecarDir(repoPath);
  await ensureDirectory(staxPath);
  const snapshot = await collectGitSnapshot(repoPath);
  const config = await readSidecarConfig(repoPath);
  const taskText = (await readTextIfExists(path.join(staxPath, "task.md"))).trim();
  const task = taskText || `STAX sidecar audit for ${snapshot.repoName}.`;
  const codexReport = stripGeneratedProofStrengthSection(await readTextIfExists(path.join(staxPath, "codex-report.md"))).trim();
  const currentFingerprint = await collectWorktreeFingerprint(repoPath);
  const visualEvidenceEntries = await readVisualEvidenceForGate(repoPath, currentFingerprint);
  const currentVisualEvidenceEntries = visualEvidenceEntries.filter((entry) => entry.verificationStatus === "verified_current_visual_proof");
  const commandEvidenceEntries = await readCommandEvidenceEntries(repoPath, snapshot, currentFingerprint);
  const currentCommandEvidenceEntries = latestCurrentCommandEvidenceForProof(commandEvidenceEntries);
  const proofStackCommandEvidenceEntries = await normalizeSidecarOnlyCommandEvidence(
    repoPath,
    demoteUnverifiedCommandEvidence(currentCommandEvidenceEntries),
    snapshot.commitSha
  );
  const commandEvidence = renderCommandEvidence(proofStackCommandEvidenceEntries);
  const changedFiles = resolveChangedFiles(snapshot.gitStatusShort, snapshot.unifiedDiff);
  const auditableDiff = changedFiles.length > 0;
  const auditableUnifiedDiff = auditableDiff ? snapshot.unifiedDiff : "";
  const packet: StructuredProjectControlEvidencePacket = {
    task: taskText,
    repo: snapshot.repoName,
    targetRepoPath: repoPath,
    branch: snapshot.branch,
    headSha: snapshot.commitSha,
    gitStatusShort: snapshot.gitStatusShort,
    changedFiles,
    unifiedDiff: auditableUnifiedDiff,
    commandEvidence: proofStackCommandEvidenceEntries,
    codexReport,
    visualEvidence: currentVisualEvidenceEntries,
    dataProofArtifacts: [],
    releaseProofArtifacts: [],
    humanApproval: []
  };

  const proofStack = buildProjectControlProofStack({
    task: taskText,
    repoEvidence: renderRepoEvidence(snapshot),
    commandEvidence,
    codexReport,
    changedFiles,
    unifiedDiff: auditableUnifiedDiff,
    commandEvidenceEntries: proofStackCommandEvidenceEntries,
    visualEvidence: currentVisualEvidenceEntries,
    targetRepoPath: repoPath,
    expectedRepo: snapshot.repoName,
    expectedBranch: snapshot.branch,
    expectedCommitSha: snapshot.commitSha,
    expectedCwd: repoPath
  });

  const extra = await deriveSidecarFindings({
    hasDiff: auditableDiff,
    changedFiles,
    codexReport,
    commandEvidenceEntries,
    visualEvidenceEntries,
    repoPath,
    snapshot
  });
  const proofStrength = await deriveSidecarProofStrength({
    task: taskText,
    codexReport,
    changedFiles,
    commandEvidenceEntries,
    visualEvidenceEntries,
    repoPath,
    snapshot,
    generatedAt: nowIso()
  });
  const runtime = await deriveRuntimeFindings(repoPath, config, options.now ?? new Date());
  const protocol = await verifyProtocolCompliance({
    repoPath,
    codexReportText: codexReport,
    mode: config.turnComplianceMode ?? (config.requireFreshCodexTurnCapture ? "strict" : "normal"),
    codexClaimsCompletion: /\b(done|complete|finished|ready)\b/i.test(codexReport),
    hasDiff: auditableDiff
  });
  const compliance = protocolComplianceFindings(protocol);
  const proofStrengthSections = proofStrengthFindings(proofStrength);

  const verified = dedupe([
      ...(!auditableDiff
      ? ["No working-tree diff is currently present."]
      : [`Working-tree diff detected with ${changedFiles.length} changed file(s).`]),
    ...proofStack.verified,
    ...extra.verified,
    ...proofStrengthSections.verified,
    ...runtime.verified,
    ...compliance.verified
  ]);
  const weak = dedupe([...proofStack.weak, ...extra.weak, ...proofStrengthSections.weak, ...runtime.weak, ...compliance.weak]);
  const unverified = dedupe([...proofStack.unverified, ...extra.unverified, ...proofStrengthSections.unverified, ...runtime.unverified, ...compliance.unverified]);
  const risk = dedupe([...proofStack.risk, ...extra.risk, ...proofStrengthSections.risk, ...runtime.risk, ...compliance.risk]);
  const verdict = deriveVerdict({
    hasDiff: auditableDiff,
    codexReport,
    weak,
    unverified,
    risk
  });
  const why = deriveWhy(verdict, weak, unverified, risk);
  const proofSurfaceHint = await proofSurfacePromptHint({ repoPath, reportText: codexReport, unverified, risk });
  const oneNextAction = deriveNextAction(verdict, codexReport, commandEvidenceEntries, repoPath, unverified, risk, proofSurfaceHint);
  const codexPrompt = deriveCodexPrompt(verdict, oneNextAction, unverified, risk);
  const exitCode = exitCodeForVerdict(verdict);
  const statusMarkdown = renderStatusMarkdown({
    verdict,
    why,
    verified,
    weak,
    unverified,
    risk,
    oneNextAction,
    codexPrompt,
    proofStrength,
    protocol
  });
  const cardShapeIssues = validateProjectControlCardShape(statusMarkdown);
  const status: StaxGateStatus = {
    schemaVersion: "stax-sidecar-status-v1",
    generatedAt: nowIso(),
    repo: snapshot.repoName,
    repoPath,
    branch: snapshot.branch,
    commitSha: snapshot.commitSha,
    task,
    verdict,
    exitCode,
    why,
    verified,
    weak,
    unverified,
    risk,
    oneNextAction,
    codexPrompt,
    proofStrength,
    protocolStatus: protocol.status,
    protocolFailures: protocol.findings,
    protocol,
    statusMarkdown,
    cardShapeIssues
  };

  await writeSidecarStatus(repoPath, status, commandEvidenceEntries, visualEvidenceEntries);
  const turnContract = await writeTurnContract({ repoPath });
  status.turnContract = {
    turnId: turnContract.turnId,
    requiredAcknowledgement: turnContract.requiredAcknowledgement,
    statusHash: turnContract.statusHash,
    nextPromptHash: turnContract.nextPromptHash
  };
  await updateTaskLedger(repoPath, status);
  if (options.writeLearningEvent ?? true) {
    await maybeWriteGateLearningEvent(repoPath, status, packet);
  }
  return status;
}

export async function printStaxStatus(repoPathInput: string): Promise<string> {
  const repoPath = await validateRepoPath(repoPathInput);
  const statusPath = path.join(sidecarDir(repoPath), "status.md");
  const existing = await readTextIfExists(statusPath);
  if (existing.trim()) return existing;
  const status = await runStaxGate({ repoPath, writeLearningEvent: false });
  return status.statusMarkdown;
}

type SidecarConfig = {
  requireFreshCodexTurnCapture?: boolean;
  maxCodexTurnAgeMs?: number;
  maxSidecarHeartbeatAgeMs?: number;
  runtimeFreshnessMode?: TurnComplianceMode;
  turnComplianceMode?: TurnComplianceMode;
};

async function readSidecarConfig(repoPath: string): Promise<SidecarConfig> {
  const raw = await readTextIfExists(path.join(sidecarDir(repoPath), "config.json"));
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as SidecarConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function deriveRuntimeFindings(
  repoPath: string,
  config: SidecarConfig,
  now: Date
): Promise<Pick<StaxGateStatus, "verified" | "weak" | "unverified" | "risk">> {
  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risk: string[] = [];
  const mode = runtimeFreshnessModeForConfig(config);
  if (mode === "manual") return { verified, weak, unverified, risk };

  const recordFreshnessIssue = (message: string, riskMessage: string): void => {
    if (mode === "strict") {
      unverified.push(message);
      risk.push(riskMessage);
      return;
    }
    weak.push(message);
  };

  const nowMs = now.getTime();
  const heartbeatMaxAge = config.maxSidecarHeartbeatAgeMs ?? 300000;
  const turnMaxAge = config.maxCodexTurnAgeMs ?? 300000;
  const heartbeatRaw = await readTextIfExists(path.join(sidecarDir(repoPath), "runtime", "heartbeat.json"));
  const currentTurnRaw = await readTextIfExists(path.join(sidecarDir(repoPath), "current-turn.json"));

  if (!heartbeatRaw.trim()) {
    recordFreshnessIssue(
      "Fresh STAX sidecar heartbeat is missing.",
      "False Pass risk: sidecar runtime is not proven alive for this turn."
    );
  } else {
    const heartbeat = parseJsonObject(heartbeatRaw);
    const updatedAt = parseTimestampMs(heartbeat?.updatedAt);
    const ageMs = updatedAt === undefined ? undefined : nowMs - updatedAt;
    if (ageMs === undefined) {
      recordFreshnessIssue(
        "STAX sidecar heartbeat has invalid updatedAt.",
        "False Pass risk: sidecar runtime freshness cannot be verified."
      );
    } else if (ageMs < 0 || ageMs > heartbeatMaxAge) {
      recordFreshnessIssue(
        "STAX sidecar heartbeat is stale.",
        "False Pass risk: sidecar runtime heartbeat is stale."
      );
    } else {
      verified.push(`Fresh STAX sidecar heartbeat is present (${ageMs}ms old).`);
    }
  }

  if (!currentTurnRaw.trim()) {
    recordFreshnessIssue(
      "Fresh Codex turn capture is missing.",
      "False Pass risk: STAX has not captured the current Codex turn content."
    );
  } else {
    const currentTurn = parseJsonObject(currentTurnRaw);
    const capturedAt = parseTimestampMs(currentTurn?.capturedAt);
    const ageMs = capturedAt === undefined ? undefined : nowMs - capturedAt;
    const sessionId = typeof currentTurn?.sessionId === "string" ? currentTurn.sessionId : "";
    const messages = Array.isArray(currentTurn?.messages) ? currentTurn.messages : [];
    if (ageMs === undefined) {
      recordFreshnessIssue(
        "Codex turn capture has invalid capturedAt.",
        "False Pass risk: Codex turn capture freshness cannot be verified."
      );
    } else if (ageMs < 0 || ageMs > turnMaxAge) {
      recordFreshnessIssue(
        "Codex turn capture is stale.",
        "False Pass risk: Codex turn capture is stale."
      );
    } else if (!sessionId || messages.length === 0) {
      recordFreshnessIssue(
        "Codex turn capture is malformed or empty.",
        "False Pass risk: Codex turn capture has no usable session messages."
      );
    } else {
      verified.push(`Fresh Codex turn capture is present for session ${sessionId} with ${messages.length} message(s).`);
    }
  }

  return { verified, weak, unverified, risk };
}

function runtimeFreshnessModeForConfig(config: SidecarConfig): TurnComplianceMode {
  if (config.runtimeFreshnessMode) return config.runtimeFreshnessMode;
  if (config.requireFreshCodexTurnCapture) return "strict";
  return "normal";
}

function protocolComplianceFindings(
  protocol: ProtocolComplianceResult
): Pick<StaxGateStatus, "verified" | "weak" | "unverified" | "risk"> {
  if (protocol.mode === "manual") {
    return { verified: [], weak: [], unverified: [], risk: [] };
  }
  if (protocol.status === "ok") {
    return {
      verified: [`Protocol compliance verified: Codex acknowledged current STAX turn contract: ${protocol.acknowledgement}`],
      weak: [],
      unverified: [],
      risk: []
    };
  }

  const nonBlockingWarnings = protocol.findings.filter((finding) => isNonBlockingProtocolWarning(protocol, finding));
  const weak = protocol.findings
    .filter((finding) => finding.severity === "warning" && !isNonBlockingProtocolWarning(protocol, finding))
    .map((finding) => finding.message);
  const humanReview = protocol.findings
    .filter((finding) => finding.severity === "human_review")
    .map((finding) => `Protocol compliance requires human review: ${finding.message}`);
  const unverified = protocol.findings
    .filter((finding) => finding.severity === "reject")
    .map((finding) => finding.message);
  const risk = [
    ...humanReview,
    ...(unverified.length > 0
      ? ["Protocol failure: Codex did not prove it followed the current STAX sidecar contract."]
      : [])
  ];
  return {
    verified: nonBlockingWarnings.map((finding) => `Protocol warning recorded as non-blocking: ${finding.message}`),
    weak,
    unverified,
    risk
  };
}

function isNonBlockingProtocolWarning(protocol: ProtocolComplianceResult, finding: ProtocolComplianceFinding): boolean {
  return finding.severity === "warning"
    && finding.id === "current_turn_capture_missing_ack"
    && Boolean(protocol.acknowledgement)
    && /report acknowledgement is present/i.test(finding.message);
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function parseTimestampMs(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function writeSidecarStatus(
  repoPath: string,
  status: StaxGateStatus,
  commandEvidenceEntries: SidecarCommandEvidenceEntry[] = [],
  visualEvidenceEntries: VerifiedVisualEvidence[] = []
): Promise<void> {
  const staxPath = sidecarDir(repoPath);
  await ensureDirectory(staxPath);
  await fs.writeFile(path.join(staxPath, "status.md"), status.statusMarkdown, "utf8");
  const { statusMarkdown, ...jsonStatus } = status;
  await fs.writeFile(path.join(staxPath, "status.json"), `${JSON.stringify(jsonStatus, null, 2)}\n`, "utf8");
  if (status.proofStrength) {
    await fs.writeFile(path.join(staxPath, "proof_strength.json"), `${JSON.stringify(status.proofStrength, null, 2)}\n`, "utf8");
  } else {
    await fs.rm(path.join(staxPath, "proof_strength.json"), { force: true });
  }
  await writeCodexReportProofStrengthSection(repoPath, status.proofStrength);
  await writeLatestProofReport(repoPath, status, commandEvidenceEntries, visualEvidenceEntries);
  await writeLatestConfidenceReport(repoPath, status);
  await fs.writeFile(
    path.join(staxPath, "next-codex-prompt.md"),
    status.verdict === "Accept" ? `No correction prompt needed. ${STAX_ACCEPT_BOUNDARY}\n` : `${status.codexPrompt}\n`,
    "utf8"
  );
}

function renderStatusMarkdown(input: {
  verdict: StaxGateVerdict;
  why: string;
  verified: string[];
  weak: string[];
  unverified: string[];
  risk: string[];
  oneNextAction: string;
  codexPrompt: string;
  proofStrength?: ProofStrengthResult;
  protocol?: ProtocolComplianceResult;
}): string {
  return [
    "## Verdict",
    `- Status: ${input.verdict}`,
    `- Why: ${input.why}`,
    `- Accept Boundary: ${STAX_ACCEPT_BOUNDARY}`,
    "",
    "## Verified",
    ...renderBullets(input.verified, "Nothing verified yet."),
    "",
    "## Weak / Provisional",
    ...renderBullets(input.weak, "No weak proof recorded."),
    "",
    "## Unverified",
    ...renderBullets(input.unverified, "No unverified claims recorded."),
    "",
    "## Risk",
    ...renderBullets(input.risk, "No active risk recorded."),
    "",
    "## Proof Strength",
    ...renderProofStrength(input.proofStrength),
    "",
    "## Protocol Compliance",
    ...renderProtocolCompliance(input.protocol),
    "",
    "## One Next Action",
    `- ${input.oneNextAction}`,
    "",
    "## Codex Prompt if needed",
    input.codexPrompt
  ].join("\n") + "\n";
}

function renderProtocolCompliance(protocol?: ProtocolComplianceResult): string[] {
  if (!protocol) return ["- Status: unknown"];
  return [
    `- Status: ${protocol.status}`,
    `- Mode: ${protocol.mode}`,
    `- Required Sections Present: ${protocol.requiredSectionsPresent.join(", ") || "none"}`,
    `- Missing Required Sections: ${protocol.missingRequiredSections.join(", ") || "none"}`,
    ...protocol.findings.map((finding) => `- ${finding.severity}: ${finding.message}`)
  ];
}

function renderProofStrength(proofStrength?: ProofStrengthResult): string[] {
  if (!proofStrength) return ["- No proof-strength artifact was generated for this gate run."];
  return [
    `- Label: ${proofStrength.label}`,
    `- Raw Score: ${proofStrength.rawScore}`,
    `- Final Score: ${proofStrength.finalScore}`,
    `- Primary Limiter: ${proofStrength.primaryLimiter}`,
    `- Caps Applied: ${proofStrength.capApplied.map((cap) => cap.id).join(", ") || "none"}`,
    "- Artifact: .stax/proof_strength.json",
    `- Proof Report: ${STAX_PROOF_REPORT_RELATIVE_PATH}`,
    `- Confidence Report: ${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`
  ];
}

async function writeCodexReportProofStrengthSection(
  repoPath: string,
  proofStrength?: ProofStrengthResult
): Promise<void> {
  const reportPath = path.join(sidecarDir(repoPath), "codex-report.md");
  const codexAuthoredReport = stripGeneratedProofStrengthSection(await readTextIfExists(reportPath)).trimEnd();
  const section = renderCodexReportProofStrengthSection(proofStrength);
  const next = codexAuthoredReport ? `${codexAuthoredReport}\n\n${section}\n` : `${section}\n`;
  await fs.writeFile(reportPath, next, "utf8");
}

function renderCodexReportProofStrengthSection(proofStrength?: ProofStrengthResult): string {
  if (!proofStrength) {
    return [
      STAX_PROOF_STRENGTH_SECTION_START,
      "## STAX Proof Strength",
      "",
      "Generated by `stax gate`; this is STAX audit output, not a Codex completion claim.",
      "",
      "- Summary: No formal proof-strength artifact was generated for this gate run.",
      `- Accept Boundary: ${STAX_ACCEPT_BOUNDARY}`,
      `- Proof report: ${STAX_PROOF_REPORT_RELATIVE_PATH}`,
      `- Confidence report: ${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`,
      STAX_PROOF_STRENGTH_SECTION_END
    ].join("\n");
  }

  return [
    STAX_PROOF_STRENGTH_SECTION_START,
    "## STAX Proof Strength",
    "",
    "Generated by `stax gate`; this is STAX audit output, not a Codex completion claim.",
    "",
    `- Claim Type: ${proofStrength.claimType}`,
    `- Label: ${proofStrength.label}`,
    `- Raw Score: ${proofStrength.rawScore}`,
    `- Final Score: ${proofStrength.finalScore}`,
    `- Caps Applied: ${proofStrength.capApplied.map((cap) => cap.id).join(", ") || "none"}`,
    `- Primary Limiter: ${proofStrength.primaryLimiter}`,
    `- Next Proof Action: ${proofStrength.oneNextAction}`,
    `- Accept Boundary: ${STAX_ACCEPT_BOUNDARY}`,
    `- Proof report: ${STAX_PROOF_REPORT_RELATIVE_PATH}`,
    "- Artifact: .stax/proof_strength.json",
    `- Confidence Report: ${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`,
    STAX_PROOF_STRENGTH_SECTION_END
  ].join("\n");
}

function stripGeneratedProofStrengthSection(input: string): string {
  const sectionPattern = new RegExp(
    `\\n*${escapeRegex(STAX_PROOF_STRENGTH_SECTION_START)}[\\s\\S]*?${escapeRegex(STAX_PROOF_STRENGTH_SECTION_END)}\\n*`,
    "g"
  );
  return input.replace(sectionPattern, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function writeLatestProofReport(
  repoPath: string,
  status: StaxGateStatus,
  commandEvidenceEntries: SidecarCommandEvidenceEntry[],
  visualEvidenceEntries: VerifiedVisualEvidence[]
): Promise<void> {
  const reportPath = path.join(repoPath, STAX_PROOF_REPORT_RELATIVE_PATH);
  await ensureDirectory(path.dirname(reportPath));
  await fs.writeFile(reportPath, renderLatestProofReport(status, commandEvidenceEntries, visualEvidenceEntries), "utf8");
}

async function writeLatestConfidenceReport(repoPath: string, status: StaxGateStatus): Promise<void> {
  const reportPath = path.join(repoPath, STAX_CONFIDENCE_REPORT_RELATIVE_PATH);
  await ensureDirectory(path.dirname(reportPath));
  await fs.writeFile(reportPath, renderLatestConfidenceReport(status), "utf8");
}

function renderLatestProofReport(
  status: StaxGateStatus,
  commandEvidenceEntries: SidecarCommandEvidenceEntry[],
  visualEvidenceEntries: VerifiedVisualEvidence[]
): string {
  const proofStrength = status.proofStrength;
  const repoLines = [
    status.branch ? `- Branch: ${status.branch}` : "",
    status.commitSha ? `- Commit: ${status.commitSha}` : ""
  ].filter(Boolean);
  return [
    "# STAX Proof Report",
    "",
    "Generated by `stax gate`. This is the stable repo-tracked proof summary; local runtime captures and raw command logs stay in ignored sidecar files.",
    "",
    "## Verdict",
    `- Status: ${status.verdict}`,
    `- Why: ${sanitizeProofReportText(status.why, status.repoPath)}`,
    `- Accept Boundary: ${STAX_ACCEPT_BOUNDARY}`,
    `- Generated At: ${status.generatedAt}`,
    `- Repo: ${status.repo}`,
    ...repoLines,
    `- Task: ${sanitizeProofReportText(status.task, status.repoPath)}`,
    "",
    "## Proof Strength",
    ...(proofStrength
      ? [
          `- Claim Type: ${proofStrength.claimType}`,
          `- Label: ${proofStrength.label}`,
          `- Raw Score: ${proofStrength.rawScore}`,
          `- Final Score: ${proofStrength.finalScore}`,
          `- Caps Applied: ${proofStrength.capApplied.map((cap) => cap.id).join(", ") || "none"}`,
          `- Primary Limiter: ${sanitizeProofReportText(proofStrength.primaryLimiter, status.repoPath)}`,
          `- One Next Proof Action: ${sanitizeProofReportText(proofStrength.oneNextAction, status.repoPath)}`
        ]
      : ["- No proof-strength artifact was generated for this gate run."]),
    "",
    "## Protocol Compliance",
    ...renderProtocolCompliance(status.protocol).map((line) => sanitizeProtocolReportLine(line, status.repoPath)),
    "",
    "## Command Evidence",
    ...renderCommandEvidenceReportLines(commandEvidenceEntries),
    "",
    "## Visual Evidence",
    ...renderVisualEvidenceReportLines(visualEvidenceEntries, status.repoPath),
    "",
    "## Verified",
    ...renderDurableProofBullets(status.verified, status.repoPath, "No durable verified proof recorded."),
    "",
    "## Weak / Provisional",
    ...renderDurableProofBullets(status.weak, status.repoPath, "No weak proof recorded."),
    "",
    "## Unverified",
    ...renderDurableProofBullets(status.unverified, status.repoPath, "No unverified claims recorded."),
    "",
    "## Risk",
    ...renderDurableProofBullets(status.risk, status.repoPath, "No active risk recorded."),
    "",
    "## Evidence Artifacts",
    "- Status JSON: .stax/status.json",
    "- Proof strength JSON: .stax/proof_strength.json",
    `- Confidence report: ${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`,
    "- Next Codex prompt: .stax/next-codex-prompt.md",
    "- Raw Codex working report: .stax/codex-report.md (local sidecar input)",
    "- Command evidence proof: external STAX evidence store; .stax/command-evidence/ contains repo-local pointers only.",
    "- Visual evidence proof: .stax/visual-proofs/manifest.json plus screenshot artifacts.",
    "",
    "## One Next Action",
    `- ${sanitizeProofReportText(status.oneNextAction, status.repoPath)}`,
    ""
  ].join("\n");
}

function renderLatestConfidenceReport(status: StaxGateStatus): string {
  const proofStrength = status.proofStrength;
  const repoLines = [
    status.branch ? `- Branch: ${status.branch}` : "",
    status.commitSha ? `- Commit: ${status.commitSha}` : ""
  ].filter(Boolean);
  return [
    "# STAX Confidence Strength Report",
    "",
    "Generated by `stax gate`. This is the stable repo-tracked confidence-strength summary; raw command logs stay in ignored sidecar files.",
    "",
    "## Verdict",
    `- Status: ${status.verdict}`,
    `- Why: ${sanitizeProofReportText(status.why, status.repoPath)}`,
    `- Accept Boundary: ${STAX_ACCEPT_BOUNDARY}`,
    `- Generated At: ${status.generatedAt}`,
    `- Repo: ${status.repo}`,
    ...repoLines,
    `- Task: ${sanitizeProofReportText(status.task, status.repoPath)}`,
    "",
    "## Confidence Strength",
    ...(proofStrength
      ? [
          `- Claim Type: ${proofStrength.claimType}`,
          `- Label: ${proofStrength.label}`,
          `- Raw Score: ${proofStrength.rawScore}`,
          `- Final Score: ${proofStrength.finalScore}`,
          `- Caps Applied: ${proofStrength.capApplied.map((cap) => cap.id).join(", ") || "none"}`,
          `- Primary Limiter: ${sanitizeProofReportText(proofStrength.primaryLimiter, status.repoPath)}`,
          `- One Next Proof Action: ${sanitizeProofReportText(proofStrength.oneNextAction, status.repoPath)}`
        ]
      : ["- No proof-strength artifact was generated for this gate run."]),
    "",
    "## Protocol Compliance",
    ...renderProtocolCompliance(status.protocol).map((line) => sanitizeProtocolReportLine(line, status.repoPath)),
    "",
    "## Strong Proof",
    ...renderProofStrengthEvidenceBullets(proofStrength?.strongProof ?? [], status.repoPath, "No strong proof recorded."),
    "",
    "## Weak Proof",
    ...renderProofStrengthEvidenceBullets(proofStrength?.weakProof ?? [], status.repoPath, "No weak proof recorded."),
    "",
    "## Missing Proof",
    ...renderProofStrengthEvidenceBullets(proofStrength?.missingProof ?? [], status.repoPath, "No missing proof recorded."),
    "",
    "## Reject Reasons",
    ...renderProofStrengthEvidenceBullets(proofStrength?.rejectReasons ?? [], status.repoPath, "No proof-strength reject reasons recorded."),
    "",
    "## Evidence Artifacts",
    "- Proof strength JSON: .stax/proof_strength.json",
    `- Proof report: ${STAX_PROOF_REPORT_RELATIVE_PATH}`,
    "- Status JSON: .stax/status.json",
    "",
    "## One Next Action",
    `- ${sanitizeProofReportText(status.oneNextAction, status.repoPath)}`,
    ""
  ].join("\n");
}

function renderCommandEvidenceReportLines(commandEvidenceEntries: SidecarCommandEvidenceEntry[]): string[] {
  const entries = latestCommandEvidenceByCommand(commandEvidenceEntries).slice(0, 10);
  if (entries.length === 0) return ["- No command evidence captured."];
  return entries.map((entry) => {
    const evidenceId = entry.evidenceId ?? `sidecar-${shortHash(`${entry.command}:${entry.finishedAt ?? entry.startedAt ?? ""}`)}`;
    const exit = entry.exitCode === undefined || entry.exitCode === null ? "unknown" : String(entry.exitCode);
    const commit = entry.commitSha ? `, commit ${entry.commitSha.slice(0, 12)}` : "";
    const branch = entry.branch ? `, branch ${entry.branch}` : "";
    const provenance = entry.provenanceStatus ? `, provenance ${entry.provenanceStatus}` : "";
    const store = entry.evidenceStore === "external_user_store"
      ? ", store external_user_store"
      : entry.evidenceStore === "repo_local_legacy"
        ? ", store repo_local_legacy"
        : "";
    const externalPath = entry.externalEvidencePath
      ? `, evidence ${displayExternalEvidencePath(entry.externalEvidencePath)}`
      : "";
    return `- ${evidenceId}: \`${entry.command}\` exited ${exit} (${entry.source ?? "unknown_source"}${branch}${commit}${provenance}${store}${externalPath})`;
  });
}

function renderVisualEvidenceReportLines(visualEvidenceEntries: VerifiedVisualEvidence[], repoPath: string): string[] {
  if (visualEvidenceEntries.length === 0) return ["- No visual evidence captured."];
  return visualEvidenceEntries.slice(0, 10).map((entry) => {
    const proofPath = entry.path ? sanitizeProofReportText(entry.path, repoPath) : "no artifact path";
    const checklist = entry.checklistItems.length > 0 ? `, checklist ${entry.checklistItems.join(", ")}` : "";
    const issues = entry.verificationIssues.length > 0 ? `, issues ${entry.verificationIssues.join("; ")}` : "";
    return `- ${entry.proofId}: ${entry.verificationStatus}, ${entry.source}, ${proofPath}${checklist}${issues}`;
  });
}

function renderDurableProofBullets(items: string[], repoPath: string, fallback: string): string[] {
  const durableItems = items
    .filter((item) => !isLocalRuntimeFinding(item))
    .map((item) => sanitizeProofReportText(item, repoPath));
  return renderBullets(durableItems, fallback);
}

function renderProofStrengthEvidenceBullets(items: string[], repoPath: string, fallback: string): string[] {
  return renderBullets(items.map((item) => sanitizeProofReportText(item, repoPath)), fallback);
}

function isLocalRuntimeFinding(item: string): boolean {
  return /^(Fresh STAX sidecar heartbeat|Fresh Codex turn capture|Codex acknowledged current STAX turn contract)/.test(item);
}

function sanitizeProofReportText(input: string, repoPath: string): string {
  return input
    .replace(new RegExp(escapeRegex(path.resolve(repoPath)), "g"), "<repo>")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeProtocolReportLine(input: string, repoPath: string): string {
  return sanitizeProofReportText(input, repoPath);
}

function renderBullets(items: string[], fallback: string): string[] {
  const source = items.length > 0 ? items : [fallback];
  return source.map((item) => `- ${item}`);
}

async function deriveSidecarProofStrength(input: {
  task: string;
  codexReport: string;
  changedFiles: ProjectControlChangedFile[];
  commandEvidenceEntries: SidecarCommandEvidenceEntry[];
  visualEvidenceEntries: VerifiedVisualEvidence[];
  repoPath: string;
  snapshot: { repoName: string; branch?: string; commitSha?: string; gitStatusShort?: string };
  generatedAt: string;
}): Promise<ProofStrengthResult | undefined> {
  const explicitClaimText = [input.task, input.codexReport].filter((item) => item.trim()).join("\n\n");
  const commandEvidenceEntries = latestCurrentCommandEvidenceForProof(input.commandEvidenceEntries);
  const commandEvidence = commandEvidenceEntries.map((entry) => sidecarCommandEvidence(entry, input.repoPath));
  const claimType = inferProofStrengthClaimTypeFromClaims(explicitClaimText) ?? (commandEvidence.length > 0 ? "verification_run" : undefined);
  if (!claimType) return undefined;
  const claimText = explicitClaimText || "Verification run.";
  const evidenceFiles = mergeChangedFiles(input.changedFiles, await existingMentionedFiles(input.repoPath, claimText));
  const repoEvidence = sidecarRepoEvidencePack({
    repoPath: input.repoPath,
    snapshot: input.snapshot,
    changedFiles: evidenceFiles,
    createdAt: input.generatedAt
  });
  const initialGroundingResult = new EvidenceGroundingGate().evaluate({
    output: claimTextForGrounding(claimText, input.repoPath, input.snapshot.branch),
    repoEvidence,
    commandEvidence
  });
  const groundingResult = supportVisualGroundingClaims(
    initialGroundingResult,
    claimType,
    input.visualEvidenceEntries
  );
  return new ProofStrengthGate().evaluate({
    claimType,
    claimText,
    groundingResult,
    commandEvidence,
    repoEvidence,
    expectedRepoPath: input.repoPath,
    evidenceFlags: sidecarEvidenceFlags(input.codexReport, input.visualEvidenceEntries)
  });
}

const CLAIM_FILE_PATTERN =
  /\b(?:[A-Za-z0-9_.-]+\/)+(?:[A-Za-z0-9_.-]+\.[A-Za-z0-9]+)\b|\b[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|json|md|css|html|yml|yaml)\b/g;

async function existingMentionedFiles(repoPath: string, text: string): Promise<ProjectControlChangedFile[]> {
  const mentionedPaths = [
    ...new Set(
      [...text.matchAll(CLAIM_FILE_PATTERN)]
        .map((match) => normalizeMentionedPath(match[0]))
        .filter((item): item is string => Boolean(item) && !isLikelyUrlPath(item))
    )
  ];
  const files: ProjectControlChangedFile[] = [];
  for (const mentionedPath of mentionedPaths) {
    if (isSidecarManagedPath(mentionedPath) || path.isAbsolute(mentionedPath) || mentionedPath.includes("..")) continue;
    const absolutePath = path.join(repoPath, mentionedPath);
    const stat = await fs.stat(absolutePath).catch(() => undefined);
    if (!stat?.isFile()) continue;
    files.push({
      path: mentionedPath,
      changeType: "modified",
      fileRole: classifyFileRole(mentionedPath)
    });
  }
  return files;
}

function normalizeMentionedPath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/[.,;:)]+$/g, "");
}

function claimTextForGrounding(claimText: string, repoPath: string, branch?: string): string {
  const repoPathPattern = new RegExp(escapeRegex(path.resolve(repoPath)).replace(/\//g, "/+"), "g");
  const withoutRepoPaths = claimText
    .replace(repoPathPattern, "<repo>")
    .replace(/(^|[\s`'("])\.?stax\/[^\s`'")]+/gi, "$1<sidecar-file>")
    .replace(/\b(?:AGENTS\.md|\.gitignore)\b/g, "<sidecar-file>")
    .replace(/(^|[\s(])\/[^\s`'")]+/g, "$1<path>")
    .replace(/\bbranch\/head\b/gi, "branch and head")
    .replace(/\bweak\/provisional\b/gi, "weak or provisional");
  if (!branch?.includes("/")) return withoutRepoPaths;
  return withoutRepoPaths.replace(new RegExp(escapeRegex(branch), "g"), "<branch>");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergeChangedFiles(
  changedFiles: ProjectControlChangedFile[],
  mentionedFiles: ProjectControlChangedFile[]
): ProjectControlChangedFile[] {
  const byPath = new Map<string, ProjectControlChangedFile>();
  for (const file of changedFiles) byPath.set(file.path, file);
  for (const file of mentionedFiles) {
    if (!byPath.has(file.path)) byPath.set(file.path, file);
  }
  return [...byPath.values()];
}

function sidecarRepoEvidencePack(input: {
  repoPath: string;
  snapshot: { repoName: string; branch?: string; commitSha?: string; gitStatusShort?: string };
  changedFiles: ProjectControlChangedFile[];
  createdAt: string;
}): RepoEvidencePack {
  const evidencePaths = input.changedFiles.map((file) => file.path);
  const sourceFiles = input.changedFiles
    .filter((file) => file.fileRole === "source" || file.fileRole === "script")
    .map((file) => file.path);
  const testFiles = input.changedFiles.filter((file) => file.fileRole === "test").map((file) => file.path);
  const docsFiles = input.changedFiles.filter((file) => file.fileRole === "docs").map((file) => file.path);
  const configFiles = input.changedFiles.filter((file) => file.fileRole === "config").map((file) => file.path);
  return {
    repoPath: input.repoPath,
    workspaceResolution: "current_repo",
    createdAt: input.createdAt,
    gitStatus: input.snapshot.gitStatusShort,
    inspectedFiles: evidencePaths,
    importantFiles: evidencePaths,
    configFiles,
    sourceFiles,
    testFiles,
    docsFiles,
    operationalFiles: [],
    scripts: [],
    missingExpectedFiles: [],
    riskFlags: [],
    skippedPaths: [],
    redactions: [],
    snippets: [],
    markdown: [
      "## Sidecar Repo Evidence",
      `- RepoPath: ${input.repoPath}`,
      input.snapshot.branch ? `- Branch: ${input.snapshot.branch}` : "",
      input.snapshot.commitSha ? `- Commit: ${input.snapshot.commitSha}` : "",
      ...evidencePaths.map((file) => `- Evidence file: ${file}`)
    ].filter(Boolean).join("\n")
  };
}

function sidecarCommandEvidence(entry: SidecarCommandEvidenceEntry, repoPath: string): CommandEvidence {
  const exitCode = typeof entry.exitCode === "number" ? entry.exitCode : -1;
  const success = exitCode === 0;
  const createdAt = entry.finishedAt ?? entry.startedAt ?? new Date(0).toISOString();
  return {
    commandEvidenceId: `sidecar-${shortHash(`${entry.command}:${createdAt}:${entry.cwd ?? repoPath}`)}`,
    command: entry.command,
    args: [entry.command],
    exitCode,
    success,
    source: sidecarCommandSource(entry.source),
    status: success ? "passed" : exitCode === -1 ? "unknown" : "failed",
    commandFamily: commandFamilyFor(entry.command),
    stdoutPath: entry.stdoutPath ?? ".stax/command-evidence/stdout.txt",
    stderrPath: entry.stderrPath ?? ".stax/command-evidence/stderr.txt",
    stdoutTruncated: false,
    stderrTruncated: false,
    redactionCount: 0,
    summary: compactCommandSummary(entry),
    createdAt,
    hash: sha256(JSON.stringify({
      command: entry.command,
      cwd: entry.cwd,
      repo: entry.repo,
      branch: entry.branch,
      commitSha: entry.commitSha,
      exitCode: entry.exitCode,
      source: entry.source
    })),
    cwd: entry.cwd,
    linkedRepoPath: entry.cwd,
    provenanceStatus: entry.provenanceStatus,
    provenanceIssues: entry.provenanceIssues
  };
}

function sidecarCommandSource(source: ProjectControlCommandEvidenceEntry["source"]): CommandEvidence["source"] {
  if (source === "local_stax_command_output" || source === "human_pasted_command_output" || source === "codex_reported_command_output") {
    return source;
  }
  return "human_pasted_command_output";
}

function compactCommandSummary(entry: ProjectControlCommandEvidenceEntry): string {
  const text = [entry.stdout, entry.stderr].filter(Boolean).join("\n").replace(/\s+/g, " ").trim();
  return text.slice(0, 2400) || `${entry.command} exited ${entry.exitCode ?? "unknown"}.`;
}

function sidecarEvidenceFlags(codexReport: string, visualEvidenceEntries: VerifiedVisualEvidence[] = []): {
  visualProof: boolean;
  releasePreflight: boolean;
  releaseGate: boolean;
  rollbackPlan: boolean;
  securityProof: boolean;
} {
  const hasVerifiedVisualProof = visualEvidenceEntries.some((entry) => entry.verificationStatus === "verified_current_visual_proof");
  return {
    visualProof: hasVerifiedVisualProof || /\b(screenshot|playwright trace|rendered preview|visual proof|browser proof)\b/i.test(codexReport),
    releasePreflight:
      /\b(preflight|dry run|staging validated|build passed|export regenerated|regenerated export|live target fetch|target fetch|deploy command|stax-collected deploy|smoke:pipeline)\b/i.test(codexReport),
    releaseGate: /\b(release gate|deploy gate|course deploy proof|course deploy contract)\b/i.test(codexReport),
    rollbackPlan: /\brollback\b/i.test(codexReport),
    securityProof: /\b(audit:security|security audit passed|security test|security scan|secret scan|vulnerability scan|npm audit|prompt injection test|xss test|csrf test)\b/i.test(codexReport)
  };
}

function supportVisualGroundingClaims(
  groundingResult: EvidenceGroundingResult,
  claimType: ProofStrengthClaimType,
  visualEvidenceEntries: VerifiedVisualEvidence[]
): EvidenceGroundingResult {
  const hasVerifiedVisualProof = visualEvidenceEntries.some((entry) => entry.verificationStatus === "verified_current_visual_proof");
  if (claimType !== "visual_behavior_verified" || !hasVerifiedVisualProof) return groundingResult;
  const claims = groundingResult.claims.map((claim): GroundedClaim => {
    if (
      claim.status === "unsupported" &&
      (claim.kind === "completion" || claim.kind === "verification") &&
      /\b(visual|layout|ui|rendered|screenshot|browser|responsive|accessibility)\b/i.test(claim.text)
    ) {
      return {
        ...claim,
        status: "supported",
        support: "stax_visual_proof_manifest",
        reason: undefined
      };
    }
    return claim;
  });
  const supportedClaims = claims.filter((claim) => claim.status === "supported");
  const weakClaims = claims.filter((claim) => claim.status === "weak");
  const unsupportedClaims = claims.filter((claim) => claim.status === "unsupported");
  return {
    pass: unsupportedClaims.length === 0,
    claims,
    supportedClaims,
    weakClaims,
    unsupportedClaims,
    requiredFixes: unsupportedClaims.map((claim) => `Remove or qualify unsupported ${claim.kind} claim: ${claim.text}`)
  };
}

function proofStrengthFindings(
  proofStrength?: ProofStrengthResult
): Pick<StaxGateStatus, "verified" | "weak" | "unverified" | "risk"> {
  if (!proofStrength) return { verified: [], weak: [], unverified: [], risk: [] };
  const summary = `Proof strength: ${proofStrength.label} (${proofStrength.finalScore}) - ${proofStrength.primaryLimiter}`;
  const capLines = proofStrength.capApplied.map((cap) => `Proof-strength cap applied: ${cap.id} - ${cap.reason}`);
  if (proofStrength.label === "Reject") {
    return {
      verified: [],
      weak: [],
      unverified: [summary, ...proofStrength.rejectReasons.map((reason) => `Proof-strength reject: ${reason}`)],
      risk: proofStrength.rejectReasons.map((reason) => `Proof-strength blocker: ${reason}`)
    };
  }
  if (proofStrength.label === "Strong" || proofStrength.label === "Audit-grade") {
    return {
      verified: [summary],
      weak: capLines,
      unverified: [],
      risk: []
    };
  }
  return {
    verified: [],
    weak: [summary, ...capLines],
    unverified: [],
    risk: []
  };
}

function deriveVerdict(input: {
  hasDiff: boolean;
  codexReport: string;
  weak: string[];
  unverified: string[];
  risk: string[];
}): StaxGateVerdict {
  if (input.unverified.length > 0 || input.risk.some((item) => /wrong repo|wrong branch|fake-complete|unsafe|unsupported|missing|malformed|docs-only|source-only/i.test(item))) {
    return "Reject";
  }
  if (!input.hasDiff && input.codexReport.trim().length === 0 && input.weak.length === 0) return "Accept";
  if (input.risk.length > 0) return "Human review";
  if (input.weak.length > 0) return "Provisional";
  return "Accept";
}

function deriveWhy(verdict: StaxGateVerdict, weak: string[], unverified: string[], risk: string[]): string {
  if (verdict === "Accept") return STAX_ACCEPT_BOUNDARY;
  if (unverified[0]) return unverified[0];
  if (risk[0]) return risk[0];
  if (weak[0]) return weak[0];
  return "Sidecar gate needs more evidence before accepting this task state.";
}

function deriveNextAction(
  verdict: StaxGateVerdict,
  codexReport: string,
  commandEvidenceEntries: ProjectControlCommandEvidenceEntry[],
  repoPath: string,
  unverified: string[],
  risk: string[],
  proofSurfaceHint?: string
): string {
  const combined = [...unverified, ...risk].join("\n").toLowerCase();
  if (verdict === "Accept") return `Record the STAX sidecar Accept, keep scope unchanged, and stop. ${STAX_ACCEPT_BOUNDARY}`;
  if (!codexReport.trim()) return "Ask Codex to write .stax/codex-report.md using the required STAX report fields.";
  if (proofSurfaceHint && (unverified.length > 0 || risk.length > 0)) return proofSurfaceHint;
  if (/visual|screenshot|rendered|layout|ui\/layout/i.test(combined)) {
    return `From the STAX checkout/tooling repo, capture first-class visual proof with npm run stax:collect-visual -- --repo ${repoPath} --url <local-preview-url> --description "<page/state verified>" --checklist "<target page/state>" --checklist "<responsive/viewport checked>" --checklist "<visible outcome>", or register an existing image with --path <screenshot.png>, then rerun stax:gate.`;
  }
  if (commandEvidenceEntries.length === 0 && /test|command|proof|exit code|passed/i.test(combined)) {
    return `Run npm run stax:collect -- --repo ${repoPath} -- npm test, or collect the repo's canonical proof command.`;
  }
  if (unverified.length === 0 && risk.length > 0) {
    return `Review this STAX risk and either accept it explicitly or rerun cleaner proof: ${risk[0]}`;
  }
  return "Ask Codex to address the first unverified proof gap and update .stax/codex-report.md with exact evidence.";
}

function deriveCodexPrompt(verdict: StaxGateVerdict, nextAction: string, unverified: string[], risk: string[]): string {
  if (verdict === "Accept") {
    return `Report the STAX sidecar Accept as proof-gate status only. ${STAX_ACCEPT_BOUNDARY} Keep the scope unchanged, and stop.`;
  }
  if (unverified.length === 0 && risk.length > 0) {
    return [
      "STAX Sidecar held this task for human review.",
      "",
      "Do not broaden scope or make unrelated changes.",
      nextAction,
      "",
      "Review these risks:",
      ...renderBullets(risk.slice(0, 5), "No specific risk item was recorded."),
      "",
      "If the risk is acceptable, record explicit approval or rerun a cleaner proof command through STAX command evidence."
    ].join("\n");
  }
  return [
    "STAX Sidecar rejected or held this task because proof is incomplete.",
    "",
    "Do exactly one cleanup pass:",
    nextAction,
    "",
    "Address these proof gaps:",
    ...renderBullets(unverified.slice(0, 5), "No specific unverified item was recorded."),
    "",
    "Do not broaden scope. Do not claim tests passed without local command evidence. Update .stax/codex-report.md, then stop.",
    risk.length > 0 ? `Risk to avoid: ${risk[0]}` : "Risk to avoid: fake-complete reporting."
  ].join("\n");
}

function exitCodeForVerdict(verdict: StaxGateVerdict): 0 | 1 | 2 {
  if (verdict === "Accept") return 0;
  if (verdict === "Reject") return 1;
  return 2;
}

function renderRepoEvidence(snapshot: {
  repoName: string;
  repoPath: string;
  branch?: string;
  commitSha?: string;
  gitStatusShort: string;
  diffStat: string;
  unifiedDiff: string;
}): string {
  return [
    `Repo: ${snapshot.repoName}`,
    `Target repo path: ${snapshot.repoPath}`,
    snapshot.branch ? `Target branch: ${snapshot.branch}` : "",
    snapshot.commitSha ? `Target commit: ${snapshot.commitSha}` : "",
    snapshot.gitStatusShort ? `Git status short:\n${snapshot.gitStatusShort}` : "Git status short: clean",
    snapshot.diffStat ? `Git diff stat:\n${snapshot.diffStat}` : "",
    snapshot.unifiedDiff ? `Unified diff:\n${snapshot.unifiedDiff}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveChangedFiles(gitStatusShort: string, unifiedDiff: string): ProjectControlChangedFile[] {
  const byPath = new Map<string, ProjectControlChangedFile>();
  for (const file of parseUnifiedDiff(unifiedDiff)) {
    if (isSidecarManagedPath(file.path)) continue;
    byPath.set(file.path, {
      path: file.path,
      changeType: file.changeType,
      fileRole: file.fileRole,
      patch: file.patch,
      oldPath: file.oldPath,
      newPath: file.newPath
    });
  }
  for (const file of parseStatusChangedFiles(gitStatusShort)) {
    if (isSidecarManagedPath(file.path)) continue;
    if (!byPath.has(file.path)) byPath.set(file.path, file);
  }
  return [...byPath.values()];
}

function parseStatusChangedFiles(gitStatusShort: string): ProjectControlChangedFile[] {
  return gitStatusShort
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const rawPath = line.slice(3).trim();
      const renamed = rawPath.includes(" -> ");
      const filePath = renamed ? rawPath.split(" -> ").at(-1)?.trim() ?? rawPath : rawPath;
      const changeType: ProjectControlChangedFile["changeType"] =
        code.includes("A") || code === "??" ? "added" : code.includes("D") ? "deleted" : renamed || code.includes("R") ? "renamed" : "modified";
      return {
        path: filePath,
        changeType,
        fileRole: classifyFileRole(filePath)
      };
    });
}

function isSidecarManagedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.?\//, "");
  return normalized === "AGENTS.md" || normalized === ".gitignore" || normalized.startsWith(".stax/");
}

async function deriveSidecarFindings(input: {
  hasDiff: boolean;
  changedFiles: ProjectControlChangedFile[];
  codexReport: string;
  commandEvidenceEntries: SidecarCommandEvidenceEntry[];
  visualEvidenceEntries: VerifiedVisualEvidence[];
  repoPath: string;
  snapshot: { repoName: string; branch?: string; commitSha?: string };
}): Promise<Pick<StaxGateStatus, "verified" | "weak" | "unverified" | "risk">> {
  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risk: string[] = [];
  const report = input.codexReport;
  const hasCommandEvidence = input.commandEvidenceEntries.length > 0;
  const roles = new Set(input.changedFiles.map((file) => file.fileRole ?? "unknown"));
  const onlyDocs = input.changedFiles.length > 0 && [...roles].every((role) => role === "docs");
  const sourceChanged = roles.has("source") || roles.has("script");
  const testChanged = roles.has("test");
  const visualChanged = roles.has("visual_style");
  const reportClaims = decomposeClaimsFromReport(report);
  const riskyRelease = reportClaims.some((claim) => claim.claimType === "release_deploy");
  const visualClaim = reportClaims.some((claim) => claim.claimType === "visual") || /\b(visual|layout|css|screenshot|rendered|looks good)\b/i.test(report);
  const implementationClaim = /\b(implemented|fixed|done|complete|ready|works|behavior|runtime)\b/i.test(report);
  const testsPassedClaim = /\b(tests? passed|npm test passed|all tests passed|test suite passed)\b/i.test(report);
  const currentVisualEvidence = input.visualEvidenceEntries.filter((entry) => entry.verificationStatus === "verified_current_visual_proof");
  const nonCurrentVisualEvidence = input.visualEvidenceEntries.filter((entry) => entry.verificationStatus !== "verified_current_visual_proof");

  if (input.hasDiff && report.trim().length === 0) {
    unverified.push("Diff exists but .stax/codex-report.md is missing.");
    risk.push("Fake-complete risk: changed files exist with no Codex report for STAX to audit.");
  }
  if (/\b(done|complete|finished|ready)\b/i.test(report) && !hasCommandEvidence) {
    unverified.push("Codex claims completion without local STAX command evidence.");
    risk.push("Fake-complete risk: completion claim has no command output with exit code.");
  }
  if (testsPassedClaim && !hasCommandEvidence) {
    unverified.push("Tests-passed claim has no local STAX command evidence.");
    risk.push("Tests-passed claims require captured command output with exit code.");
  }
  if (onlyDocs && implementationClaim) {
    unverified.push("Docs-only diff cannot prove implementation or runtime behavior.");
    risk.push("Docs-only implementation claim blocked.");
  }
  if (sourceChanged && implementationClaim && !testChanged && !hasCommandEvidence) {
    unverified.push("Source/script implementation claim lacks test diff and local command evidence.");
    risk.push("Source-only no-test/proof claim blocked.");
  }
  if (currentVisualEvidence.length > 0) {
    for (const entry of currentVisualEvidence.slice(0, 3)) {
      verified.push(`Visual evidence verified: ${entry.proofId} (${entry.source}) matches the current auditable worktree.`);
    }
  }
  const visualProofRequired = visualChanged && visualClaim;
  if (nonCurrentVisualEvidence.length > 0 && currentVisualEvidence.length === 0 && visualProofRequired) {
    for (const entry of nonCurrentVisualEvidence.slice(0, 3)) {
      weak.push(`Visual evidence ignored for current proof: ${entry.proofId} is ${entry.verificationStatus}.`);
      for (const issue of entry.verificationIssues.slice(0, 2)) weak.push(issue);
    }
  } else if (nonCurrentVisualEvidence.length > 0) {
    for (const entry of nonCurrentVisualEvidence.slice(0, 3)) {
      verified.push(`Historical visual evidence ignored for current proof because ${entry.proofId} is ${entry.verificationStatus}.`);
    }
  }
  if (visualProofRequired && currentVisualEvidence.length === 0) {
    unverified.push("Visual/style claim lacks STAX-collected rendered visual proof.");
    risk.push("Visual proof required before accepting UI/layout claims; collect it from the STAX checkout/tooling repo with stax:collect-visual using --url <local-preview-url> or --path <screenshot.png>, plus target page/state, responsive/viewport, and visible outcome checklist items.");
  }
  if (riskyRelease && !/\b(approval|rollback|dry run|preflight|build passed)\b/i.test(report)) {
    unverified.push("Deploy/publish/sync/release claim lacks approval, rollback, or preflight proof.");
    risk.push("Unsafe publish/deploy/sync claim blocked.");
  }

  const latestEntries = latestCommandEvidenceByCommand(input.commandEvidenceEntries);
  const verifiedCurrentEntries = latestEntries.filter(isVerifiedCurrentCommandEvidence);
  const verifiedCurrentPassingEntries = latestEntries.filter(isPassingVerifiedCurrentCommandEvidence);
  const hasCurrentVerifiedEvidence = verifiedCurrentEntries.length > 0;
  const entriesForStrictFindings = hasCurrentVerifiedEvidence
    ? latestEntries.filter((entry) =>
        !isSupersededFailedEvidence(entry, verifiedCurrentPassingEntries) &&
        (isVerifiedCurrentCommandEvidence(entry) || !isSupersededHistoricalEvidence(entry, verifiedCurrentEntries))
      )
    : latestEntries;
  for (const entry of entriesForStrictFindings) {
    if (entry.provenanceStatus === "verified_local_stax_command") {
      verified.push(`Command evidence provenance verified: ${entry.evidenceId ?? entry.command}.`);
      verified.push(`Command evidence freshness verified: ${entry.evidenceId ?? entry.command} matches the current auditable worktree.`);
    } else {
      const status = entry.provenanceStatus ?? "unverified_sidecar_json";
      unverified.push(`Command evidence provenance is not verified for ${entry.command}: ${status}.`);
      unverified.push(commandEvidenceLayerFailure(entry.command, status));
      risk.push(`Untrusted command evidence cannot prove Codex claims: ${status}.`);
      for (const issue of entry.provenanceIssues.slice(0, 3)) {
        weak.push(issue);
      }
    }
    if (entry.repo && entry.repo !== input.snapshot.repoName) {
      unverified.push(`Command evidence repo mismatch: ${entry.repo} does not match ${input.snapshot.repoName}.`);
      risk.push("Wrong repo command proof blocked.");
    }
    if (entry.branch && input.snapshot.branch && entry.branch !== input.snapshot.branch) {
      unverified.push(`Command evidence branch mismatch: ${entry.branch} does not match ${input.snapshot.branch}.`);
      risk.push("Wrong branch command proof blocked.");
    }
    if (entry.cwd && path.resolve(entry.cwd) !== input.repoPath) {
      unverified.push(`Command evidence cwd mismatch: ${entry.cwd} does not match ${input.repoPath}.`);
      risk.push("Wrong cwd command proof blocked.");
    }
    if (entry.commitSha && input.snapshot.commitSha && entry.commitSha !== input.snapshot.commitSha) {
      const sidecarOnlyAdvance = await evidenceCommitDiffIsSidecarManaged(input.repoPath, entry.commitSha);
      if (sidecarOnlyAdvance) {
        verified.push(
          `Command evidence ${entry.commitSha.slice(0, 12)} predates current head only by STAX sidecar artifact commits.`
        );
      } else {
        weak.push(`Command evidence commit ${entry.commitSha} differs from current head ${input.snapshot.commitSha}.`);
        risk.push("Stale command evidence must be refreshed for the current head.");
      }
    }
    if (entry.exitCode !== 0) {
      unverified.push(`Command evidence failed: ${entry.command} exited ${entry.exitCode ?? "unknown"}.`);
    }
  }
  if (hasCurrentVerifiedEvidence) {
    for (const entry of latestEntries.filter((item) => isSupersededHistoricalEvidence(item, verifiedCurrentEntries)).slice(0, 3)) {
      verified.push(`Historical command evidence ignored for current proof because ${entry.command} is ${entry.provenanceStatus}.`);
    }
  }
  const supersededFailures = input.commandEvidenceEntries.filter((entry) =>
    isSupersededFailedEvidence(entry, verifiedCurrentPassingEntries)
  );
  for (const entry of supersededFailures.slice(0, 2)) {
    const latest = verifiedCurrentPassingEntries.find((item) => commandEvidenceProofLane(item.command) === commandEvidenceProofLane(entry.command));
    const message = `Earlier failed command evidence exists but is superseded by a later passing ${entry.command} run.`;
    if (latest && isVerifiedCurrentCommandEvidence(latest)) {
      verified.push(message);
    }
  }

  return { verified, weak, unverified, risk };
}

function commandEvidenceLayerFailure(command: string, status: string): string {
  if (status === "wrong_worktree" || status === "wrong_commit") {
    return `Command evidence freshness failed for ${command}: ${status}.`;
  }
  if (status === "wrong_repo" || status === "wrong_branch" || status === "wrong_cwd") {
    return `Command evidence context failed for ${command}: ${status}.`;
  }
  return `Command evidence provenance failed for ${command}: ${status}.`;
}

async function evidenceCommitDiffIsSidecarManaged(repoPath: string, evidenceCommitSha: string): Promise<boolean> {
  const changed = await runGit(repoPath, ["diff-tree", "--no-commit-id", "--name-only", "-r", evidenceCommitSha, "HEAD"]);
  const paths = changed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return paths.length > 0 && paths.every(isWorktreeFingerprintExcludedPath);
}

async function normalizeSidecarOnlyCommandEvidence(
  repoPath: string,
  entries: ProjectControlCommandEvidenceEntry[],
  currentCommitSha?: string
): Promise<ProjectControlCommandEvidenceEntry[]> {
  if (!currentCommitSha) return entries;
  const sidecarManagedCommitCache = new Map<string, Promise<boolean>>();
  const normalized: ProjectControlCommandEvidenceEntry[] = [];
  for (const entry of entries) {
    if (entry.commitSha && entry.commitSha !== currentCommitSha && await cachedSidecarManagedCommitAdvance(repoPath, entry.commitSha, sidecarManagedCommitCache)) {
      normalized.push({ ...entry, commitSha: currentCommitSha });
      continue;
    }
    normalized.push(entry);
  }
  return normalized;
}

function cachedSidecarManagedCommitAdvance(
  repoPath: string,
  evidenceCommitSha: string,
  cache: Map<string, Promise<boolean>>
): Promise<boolean> {
  const key = `${path.resolve(repoPath)}\0${evidenceCommitSha}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = evidenceCommitDiffIsSidecarManaged(repoPath, evidenceCommitSha);
  cache.set(key, pending);
  return pending;
}

function demoteUnverifiedCommandEvidence(entries: SidecarCommandEvidenceEntry[]): ProjectControlCommandEvidenceEntry[] {
  return entries.map((entry) => {
    if (entry.provenanceStatus === "verified_local_stax_command") return entry;
    return {
      ...entry,
      source: entry.source === "codex_reported_command_output" ? "codex_reported_command_output" : "human_pasted_command_output"
    };
  });
}

async function readCommandEvidenceEntries(
  repoPath: string,
  snapshot: { repoName: string; branch?: string; commitSha?: string },
  currentFingerprint: WorktreeFingerprint
): Promise<SidecarCommandEvidenceEntry[]> {
  const sidecarManagedCommitCache = new Map<string, Promise<boolean>>();
  const externalStore = externalCommandEvidenceStoreForRepo(repoPath);
  const externalLedgerRecords = await readCommandEvidenceLedgerFromDir(externalStore.commandEvidenceDir);
  const externalLedgerTip = await readCommandEvidenceLedgerTipFromDir(externalStore.commandEvidenceDir);
  const externalEntries = await readCommandEvidenceEntriesFromDir({
    repoPath,
    snapshot,
    currentFingerprint,
    dir: externalStore.commandEvidenceDir,
    evidenceStore: "external_user_store",
    externalRepoId: externalStore.repoId,
    sidecarManagedCommitCache,
    ledgerVerification: verifyCommandEvidenceLedger(externalLedgerRecords, {
      ledgerTip: externalLedgerTip,
      requireLedgerTip: true,
      commandEvidenceDir: externalStore.commandEvidenceDir
    })
  });
  const externalEvidenceIds = new Set(externalEntries.map((entry) => entry.evidenceId).filter(Boolean));
  const legacyEntries = await readCommandEvidenceEntriesFromDir({
    repoPath,
    snapshot,
    currentFingerprint,
    dir: path.join(sidecarDir(repoPath), "command-evidence"),
    evidenceStore: "repo_local_legacy",
    sidecarManagedCommitCache,
    ledgerVerification: verifyCommandEvidenceLedger([])
  });
  return sortCommandEvidenceNewestFirst([
    ...externalEntries,
    ...legacyEntries.filter((entry) => !entry.evidenceId || !externalEvidenceIds.has(entry.evidenceId))
  ]);
}

async function readCommandEvidenceEntriesFromDir(input: {
  repoPath: string;
  snapshot: { repoName: string; branch?: string; commitSha?: string };
  currentFingerprint: WorktreeFingerprint;
  dir: string;
  evidenceStore: "external_user_store" | "repo_local_legacy";
  externalRepoId?: string;
  sidecarManagedCommitCache: Map<string, Promise<boolean>>;
  ledgerVerification: CommandEvidenceLedgerVerification;
}): Promise<SidecarCommandEvidenceEntry[]> {
  const names = await fs.readdir(input.dir).catch(() => []);
  const entries: SidecarCommandEvidenceEntry[] = [];
  for (const name of names.filter((item) => item.endsWith(".json") && !item.endsWith(".pointer.json")).sort()) {
    const filePath = path.join(input.dir, name);
    const raw = await readTextIfExists(filePath);
    if (!raw.trim()) continue;
    const parsed = JSON.parse(raw) as CommandEvidenceFile;
    const stdout = parsed.stdoutPath
      ? await readTextIfExists(path.isAbsolute(parsed.stdoutPath) ? parsed.stdoutPath : path.join(input.dir, parsed.stdoutPath))
      : parsed.stdout ?? "";
    const stderr = parsed.stderrPath
      ? await readTextIfExists(path.isAbsolute(parsed.stderrPath) ? parsed.stderrPath : path.join(input.dir, parsed.stderrPath))
      : parsed.stderr ?? "";
    const evidenceId = parsed.evidenceId ?? name.replace(/\.json$/i, "");
    const provenance = await verifySidecarCommandEvidence({
      repoPath: input.repoPath,
      currentRepoName: input.snapshot.repoName,
      currentBranch: input.snapshot.branch,
      currentCommitSha: input.snapshot.commitSha,
      currentFingerprint: input.currentFingerprint,
      parsed: parsed as Record<string, unknown> & ProjectControlCommandEvidenceEntry,
      evidenceId,
      evidenceFileName: name,
      stdoutFileName: parsed.stdoutPath,
      stderrFileName: parsed.stderrPath,
      stdout,
      stderr,
      ledgerVerification: input.ledgerVerification,
      sidecarManagedCommitCache: input.sidecarManagedCommitCache
    });
    entries.push({
      evidenceId,
      command: parsed.command,
      cwd: parsed.cwd,
      repo: parsed.repo,
      branch: parsed.branch,
      commitSha: parsed.commitSha,
      exitCode: parsed.exitCode,
      stdout,
      stderr,
      startedAt: parsed.startedAt,
      finishedAt: parsed.finishedAt,
      source: parsed.source ?? "local_stax_command_output",
      stdoutPath: parsed.stdoutPath,
      stderrPath: parsed.stderrPath,
      warning: parsed.warning,
      worktreeBefore: parsed.worktreeBefore,
      worktreeAfter: parsed.worktreeAfter,
      stdoutHash: parsed.stdoutHash,
      stderrHash: parsed.stderrHash,
      canonicalEvidenceHash: parsed.canonicalEvidenceHash,
      collectorVersion: parsed.collectorVersion,
      evidenceStore: input.evidenceStore,
      externalRepoId: parsed.externalRepoId ?? input.externalRepoId,
      externalEvidencePath: parsed.externalEvidencePath ?? (input.evidenceStore === "external_user_store" ? filePath : undefined),
      externalLedgerPath: parsed.externalLedgerPath,
      repoPointerPath: parsed.repoPointerPath,
      provenanceStatus: provenance.provenanceStatus,
      provenanceIssues: provenance.provenanceIssues,
      ledgerHash: provenance.ledgerRecord?.ledgerHash
    });
  }
  return entries;
}

function renderCommandEvidence(entries: ProjectControlCommandEvidenceEntry[]): string {
  return entries
    .map((entry) =>
      [
        entry.cwd ? `cwd=${entry.cwd}` : "",
        entry.repo ? `repo=${entry.repo}` : "",
        entry.branch ? `branch=${entry.branch}` : "",
        entry.commitSha ? `commitSha=${entry.commitSha}` : "",
        `$ ${entry.command}`,
        entry.exitCode !== undefined && entry.exitCode !== null ? `Exit code: ${entry.exitCode}` : "",
        entry.startedAt ? `startedAt=${entry.startedAt}` : "",
        entry.finishedAt ? `finishedAt=${entry.finishedAt}` : "",
        `source=${entry.source ?? "local_stax_command_output"}`,
        entry.stdout,
        entry.stderr
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function sortCommandEvidenceNewestFirst<T extends ProjectControlCommandEvidenceEntry>(
  entries: T[]
): T[] {
  return [...entries].sort((a, b) => commandEvidenceTime(b) - commandEvidenceTime(a));
}

function latestCommandEvidenceByCommand<T extends ProjectControlCommandEvidenceEntry>(
  entries: T[]
): T[] {
  const latest = new Map<string, T>();
  for (const entry of sortCommandEvidenceNewestFirst(entries)) {
    if (!latest.has(entry.command)) latest.set(entry.command, entry);
  }
  return [...latest.values()];
}

function latestCurrentCommandEvidenceForProof<T extends SidecarCommandEvidenceEntry>(
  entries: T[]
): T[] {
  const latest = latestCommandEvidenceByCommand(entries);
  const verifiedCurrentPassing = latest.filter(isPassingVerifiedCurrentCommandEvidence);
  const effectiveLatest = verifiedCurrentPassing.length > 0
    ? latest.filter((entry) => !isSupersededFailedEvidence(entry, verifiedCurrentPassing))
    : latest;
  const verifiedCurrent = effectiveLatest.filter(isVerifiedCurrentCommandEvidence);
  return verifiedCurrent.length > 0 ? verifiedCurrent : effectiveLatest;
}

function isVerifiedCurrentCommandEvidence(
  entry: ProjectControlCommandEvidenceEntry
): boolean {
  return (entry as SidecarCommandEvidenceEntry).provenanceStatus === "verified_local_stax_command";
}

function isPassingVerifiedCurrentCommandEvidence(
  entry: ProjectControlCommandEvidenceEntry
): boolean {
  return isVerifiedCurrentCommandEvidence(entry) && entry.exitCode === 0;
}

function isStaleHistoricalEvidence(
  entry: ProjectControlCommandEvidenceEntry
): boolean {
  const status = (entry as SidecarCommandEvidenceEntry).provenanceStatus;
  return status === "wrong_worktree" || status === "wrong_commit";
}

function isSupersededHistoricalEvidence(
  entry: ProjectControlCommandEvidenceEntry,
  verifiedCurrentEntries: ProjectControlCommandEvidenceEntry[]
): boolean {
  if (isVerifiedCurrentCommandEvidence(entry)) return false;
  if (isStaleHistoricalEvidence(entry)) return verifiedCurrentEntries.length > 0;
  const status = (entry as SidecarCommandEvidenceEntry).provenanceStatus;
  if (status !== "wrong_repo" && status !== "wrong_branch" && status !== "wrong_cwd") return false;
  const entryLane = commandEvidenceProofLane(entry.command);
  const entryTime = commandEvidenceTime(entry);
  return verifiedCurrentEntries.some((current) => {
    if (commandEvidenceProofLane(current.command) !== entryLane) return false;
    const currentTime = commandEvidenceTime(current);
    return currentTime === 0 || entryTime === 0 || currentTime >= entryTime;
  });
}

function isSupersededFailedEvidence(
  entry: ProjectControlCommandEvidenceEntry,
  verifiedCurrentPassingEntries: ProjectControlCommandEvidenceEntry[]
): boolean {
  if (entry.exitCode === 0) return false;
  const entryLane = commandEvidenceProofLane(entry.command);
  const entryTime = commandEvidenceTime(entry);
  return verifiedCurrentPassingEntries.some((current) => {
    if (commandEvidenceProofLane(current.command) !== entryLane) return false;
    const currentTime = commandEvidenceTime(current);
    return currentTime === 0 || entryTime === 0 || currentTime >= entryTime;
  });
}

export function commandEvidenceProofLane(command: string): string {
  const npmRun = command.match(/\bnpm\s+run(?:-script)?\s+([^\s]+)(?:\s+--\s+([^\s]+))?/i);
  if (npmRun) {
    const script = npmRun[1]?.toLowerCase() ?? "unknown";
    const action = npmRun[2] && !npmRun[2].startsWith("-") ? `:${npmRun[2].toLowerCase()}` : "";
    return `npm:${script}${action}`;
  }
  const npmBuiltIn = command.match(/\bnpm\s+(test|build|ci)\b/i);
  if (npmBuiltIn) return `npm:${npmBuiltIn[1].toLowerCase()}`;
  const pythonLane = pythonCommandProofLane(command);
  if (pythonLane) return pythonLane;
  const family = commandFamilyFor(command);
  return family === "unknown" ? `exact:${command}` : `family:${family}`;
}

function pythonCommandProofLane(command: string): string | undefined {
  const tokens = stripEnvWrapper(command.trim().split(/\s+/).filter(Boolean));
  const pythonIndex = tokens.findIndex(isPythonInterpreterToken);
  if (pythonIndex === -1) return undefined;
  const args = tokens.slice(pythonIndex + 1);
  if (args[0] === "-m" && args[1]) {
    return `python-module:${args[1].toLowerCase()}:${normalizePythonModuleArgs(args.slice(2))}`;
  }
  const script = args.find((token) => /\.py$/i.test(token));
  return script ? `python-script:${normalizeCommandPath(script)}` : "python";
}

function stripEnvWrapper(tokens: string[]): string[] {
  if (!tokens[0] || !/(^|\/)env$/i.test(tokens[0])) return tokens;
  let index = 1;
  while (tokens[index] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index += 1;
  return tokens.slice(index);
}

function isPythonInterpreterToken(token: string): boolean {
  return /(^|\/)python(?:\d+(?:\.\d+)?)?$/i.test(token);
}

function normalizePythonModuleArgs(args: string[]): string {
  return args.map(normalizeCommandPath).join(" ");
}

function normalizeCommandPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}

function commandEvidenceTime(entry: ProjectControlCommandEvidenceEntry): number {
  return Date.parse(entry.finishedAt ?? entry.startedAt ?? "") || 0;
}

async function updateTaskLedger(repoPath: string, status: StaxGateStatus): Promise<void> {
  const ledgerPath = path.join(sidecarDir(repoPath), "ledger.json");
  const raw = await readTextIfExists(ledgerPath);
  const ledger = raw
    ? (JSON.parse(raw) as { schemaVersion?: string; tasks?: Array<Record<string, unknown>> })
    : { schemaVersion: "stax-sidecar-ledger-v1", tasks: [] };
  const taskId = `task_${shortHash(status.task)}`;
  const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
  const existing = tasks.filter((task) => task.taskId !== taskId);
  const state =
    status.verdict === "Accept"
      ? "verified_next_state"
      : status.verdict === "Reject"
        ? "needs_cleanup"
        : status.verdict === "Human review"
          ? "human_review_required"
          : "audited";
  await fs.writeFile(
    ledgerPath,
    `${JSON.stringify(
      {
        schemaVersion: "stax-sidecar-ledger-v1",
        updatedAt: nowIso(),
        tasks: [
          ...existing,
          {
            taskId,
            objective: status.task,
            state,
            updatedAt: status.generatedAt,
            lastVerdict: status.verdict,
            cleanupPrompts: status.verdict === "Reject" ? 1 : 0,
            events: []
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function maybeWriteGateLearningEvent(
  repoPath: string,
  status: StaxGateStatus,
  packet: StructuredProjectControlEvidencePacket
): Promise<void> {
  const eventType = deriveEventType(status);
  if (!eventType) return;
  const taskId = `task_${shortHash(status.task)}`;
  const event: SidecarLearningEvent = {
    eventId: `evt_${sanitizeId(`${eventType}_${shortHash(`${status.generatedAt}:${status.why}:${status.repoPath}`)}`)}`,
    eventType,
    schemaVersion: "sidecar-learning-v1",
    createdAt: status.generatedAt,
    sourceRepo: {
      name: status.repo,
      pathHash: sha256(status.repoPath),
      commitSha: status.commitSha,
      branch: status.branch
    },
    task: {
      taskId,
      objective: status.task,
      finalOutcome: status.verdict === "Accept" ? "verified_next_state" : status.verdict === "Reject" ? "needs_cleanup" : "provisional"
    },
    stax: {
      verdict: status.verdict,
      useful: true,
      falseAccept: false,
      falseBlock: false,
      usefulBlock: status.verdict === "Reject",
      verifiedAccept: status.verdict === "Accept"
    },
    evidence: {
      changedFileRoles: dedupe(packet.changedFiles.map((file) => file.fileRole ?? "unknown")),
      commandProofStrengths: packet.commandEvidence.length > 0 ? packet.commandEvidence.map((entry) => entry.source) : ["none"],
      claimTypes: inferClaimTypes(packet.codexReport),
      failurePatternIds: inferFailurePatternIds(status)
    },
    promotion: {
      suggested: status.verdict === "Reject",
      target: status.verdict === "Reject" ? "regression_eval" : "none",
      scope: status.verdict === "Reject" ? "global" : "none",
      rationale: status.verdict === "Reject" ? status.why : ""
    },
    privacy: {
      redactionStatus: "clean",
      redactionNotes: []
    }
  };
  await writeSidecarLearningEvent(repoPath, event);
}

function deriveEventType(status: StaxGateStatus): SidecarLearningEventType | undefined {
  const text = [...status.unverified, ...status.risk, status.why].join("\n").toLowerCase();
  if (status.verdict === "Accept") return "verified_accept";
  if (/wrong repo/.test(text)) return "wrong_repo_prevented";
  if (/wrong branch/.test(text)) return "wrong_branch_prevented";
  if (/publish|deploy|sync|release|unsafe/.test(text)) return "unsafe_publish_blocked";
  if (/fake-complete|completion claim|done|complete/.test(text)) return "fake_complete_caught";
  if (/weak|provisional/.test(text)) return "weak_proof_blocked";
  if (status.verdict === "Reject") return "missing_proof_caught";
  if (status.verdict === "Provisional") return "generic_next_action";
  return undefined;
}

function inferFailurePatternIds(status: StaxGateStatus): string[] {
  const text = [...status.unverified, ...status.risk, status.why].join("\n").toLowerCase();
  const ids: string[] = [];
  if (/docs-only/.test(text)) ids.push("docs_only_implementation_claim");
  if (/source-only|source\/script/.test(text)) ids.push("source_only_no_test_or_command_proof");
  if (/tests-passed|test.*no local/.test(text)) ids.push("claimed_tests_passed_without_command_evidence");
  if (/wrong repo/.test(text)) ids.push("wrong_repo_command_evidence");
  if (/wrong branch/.test(text)) ids.push("wrong_branch_command_evidence");
  if (/visual/.test(text)) ids.push("visual_claim_without_rendered_proof");
  if (/publish|deploy|sync|release/.test(text)) ids.push("unsafe_release_publish_sync_claim");
  return dedupe(ids);
}

function inferClaimTypes(report: string): string[] {
  const claims = decomposeClaimsFromReport(report).map((claim) => claim.claimType);
  return dedupe(claims.length ? claims : ["unspecified"]);
}

function inferProofStrengthClaimTypeFromClaims(text: string): ProofStrengthClaimType | undefined {
  const claims = decomposeClaimsFromReport(text).map((claim) => claim.claimType);
  if (claims.includes("release_deploy")) return isCourseDeployClaimText(text) ? "course_deploy_ready" : "release_ready";
  if (claims.includes("security")) return "security_fixed";
  if (claims.includes("visual") || claims.includes("accessibility")) return "visual_behavior_verified";
  if (claims.includes("test") || claims.includes("eval")) return "tests_passed";
  if (claims.includes("implementation") || claims.includes("behavior")) return "implementation_complete";
  return undefined;
}

function isCourseDeployClaimText(text: string): boolean {
  return /\b(course|google[-\s]?hosted|firebase|hosting|hosted site|forensics|psychology|canvas-helper|authoring[_-]?unlock)\b/i.test(text) &&
    /\b(deploy(?:ed|ment)?|publish(?:ed|ing)?|live|release|export(?:ed|ing)?)\b/i.test(text);
}

function isLikelyUrlPath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  return /^(?:https?:)?\/\//i.test(normalized) || /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\//.test(normalized);
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}
