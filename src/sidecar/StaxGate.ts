import fs from "node:fs/promises";
import path from "node:path";
import { classifyFileRole } from "../diffAudit/DiffAudit.js";
import { parseUnifiedDiff } from "../diffAudit/UnifiedDiffParser.js";
import { buildProjectControlProofStack } from "../projectControl/ProjectControlProofStack.js";
import type {
  ProjectControlChangedFile,
  ProjectControlCommandEvidenceEntry,
  StructuredProjectControlEvidencePacket
} from "../projectControl/ProjectControlEvidencePacket.js";
import type { ProjectControlCardStatus } from "../projectControl/ControlCard.js";
import { validateProjectControlCardShape } from "../projectControl/ControlCard.js";
import { writeSidecarLearningEvent } from "./SidecarLearningWriter.js";
import type { SidecarLearningEvent, SidecarLearningEventType } from "./SidecarLearningEvent.js";
import { checkTurnCompliance, type TurnComplianceMode } from "./TurnCompliance.js";
import { writeTurnContract, type StaxTurnContract } from "./TurnContract.js";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  readTextIfExists,
  sanitizeId,
  sha256,
  shortHash,
  sidecarDir,
  validateRepoPath
} from "./SidecarRepo.js";

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
  stdoutPath?: string;
  stderrPath?: string;
  warning?: string;
};

export async function runStaxGate(options: RunStaxGateOptions): Promise<StaxGateStatus> {
  const repoPath = await validateRepoPath(options.repoPath);
  const staxPath = sidecarDir(repoPath);
  await ensureDirectory(staxPath);
  const snapshot = await collectGitSnapshot(repoPath);
  const config = await readSidecarConfig(repoPath);
  const task = (await readTextIfExists(path.join(staxPath, "task.md"))).trim() || `STAX sidecar audit for ${snapshot.repoName}.`;
  const codexReport = (await readTextIfExists(path.join(staxPath, "codex-report.md"))).trim();
  const commandEvidenceEntries = await readCommandEvidenceEntries(repoPath);
  const commandEvidence = renderCommandEvidence(commandEvidenceEntries);
  const changedFiles = resolveChangedFiles(snapshot.gitStatusShort, snapshot.unifiedDiff);
  const auditableDiff = changedFiles.length > 0;
  const auditableUnifiedDiff = auditableDiff ? snapshot.unifiedDiff : "";
  const packet: StructuredProjectControlEvidencePacket = {
    task,
    repo: snapshot.repoName,
    targetRepoPath: repoPath,
    branch: snapshot.branch,
    headSha: snapshot.commitSha,
    gitStatusShort: snapshot.gitStatusShort,
    changedFiles,
    unifiedDiff: auditableUnifiedDiff,
    commandEvidence: commandEvidenceEntries,
    codexReport,
    visualEvidence: [],
    dataProofArtifacts: [],
    releaseProofArtifacts: [],
    humanApproval: []
  };

  const proofStack = buildProjectControlProofStack({
    task,
    repoEvidence: renderRepoEvidence(snapshot),
    commandEvidence,
    codexReport,
    changedFiles,
    unifiedDiff: auditableUnifiedDiff,
    commandEvidenceEntries,
    targetRepoPath: repoPath,
    expectedRepo: snapshot.repoName,
    expectedBranch: snapshot.branch,
    expectedCommitSha: snapshot.commitSha,
    expectedCwd: repoPath
  });

  const extra = deriveSidecarFindings({
    hasDiff: auditableDiff,
    changedFiles,
    codexReport,
    commandEvidenceEntries,
    repoPath,
    snapshot
  });
  const runtime = await deriveRuntimeFindings(repoPath, config, options.now ?? new Date());
  const compliance = await deriveTurnComplianceFindings({
    repoPath,
    config,
    codexReport,
    hasDiff: auditableDiff
  });

  const verified = dedupe([
      ...(!auditableDiff
      ? ["No working-tree diff is currently present."]
      : [`Working-tree diff detected with ${changedFiles.length} changed file(s).`]),
    ...proofStack.verified,
    ...extra.verified,
    ...runtime.verified,
    ...compliance.verified
  ]);
  const weak = dedupe([...proofStack.weak, ...extra.weak, ...runtime.weak, ...compliance.weak]);
  const unverified = dedupe([...proofStack.unverified, ...extra.unverified, ...runtime.unverified, ...compliance.unverified]);
  const risk = dedupe([...proofStack.risk, ...extra.risk, ...runtime.risk, ...compliance.risk]);
  const verdict = deriveVerdict({
    hasDiff: auditableDiff,
    codexReport,
    weak,
    unverified,
    risk
  });
  const why = deriveWhy(verdict, weak, unverified, risk);
  const oneNextAction = deriveNextAction(verdict, codexReport, commandEvidenceEntries, repoPath, unverified, risk);
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
    codexPrompt
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
    statusMarkdown,
    cardShapeIssues
  };

  await writeSidecarStatus(repoPath, status);
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
  if (!config.requireFreshCodexTurnCapture) return { verified, weak, unverified, risk };

  const nowMs = now.getTime();
  const heartbeatMaxAge = config.maxSidecarHeartbeatAgeMs ?? 300000;
  const turnMaxAge = config.maxCodexTurnAgeMs ?? 300000;
  const heartbeatRaw = await readTextIfExists(path.join(sidecarDir(repoPath), "runtime", "heartbeat.json"));
  const currentTurnRaw = await readTextIfExists(path.join(sidecarDir(repoPath), "current-turn.json"));

  if (!heartbeatRaw.trim()) {
    unverified.push("Fresh STAX sidecar heartbeat is missing.");
    risk.push("False Pass risk: sidecar runtime is not proven alive for this turn.");
  } else {
    const heartbeat = parseJsonObject(heartbeatRaw);
    const updatedAt = parseTimestampMs(heartbeat?.updatedAt);
    const ageMs = updatedAt === undefined ? undefined : nowMs - updatedAt;
    if (ageMs === undefined) {
      unverified.push("STAX sidecar heartbeat has invalid updatedAt.");
      risk.push("False Pass risk: sidecar runtime freshness cannot be verified.");
    } else if (ageMs < 0 || ageMs > heartbeatMaxAge) {
      unverified.push("STAX sidecar heartbeat is stale.");
      risk.push("False Pass risk: sidecar runtime heartbeat is stale.");
    } else {
      verified.push(`Fresh STAX sidecar heartbeat is present (${ageMs}ms old).`);
    }
  }

  if (!currentTurnRaw.trim()) {
    unverified.push("Fresh Codex turn capture is missing.");
    risk.push("False Pass risk: STAX has not captured the current Codex turn content.");
  } else {
    const currentTurn = parseJsonObject(currentTurnRaw);
    const capturedAt = parseTimestampMs(currentTurn?.capturedAt);
    const ageMs = capturedAt === undefined ? undefined : nowMs - capturedAt;
    const sessionId = typeof currentTurn?.sessionId === "string" ? currentTurn.sessionId : "";
    const messages = Array.isArray(currentTurn?.messages) ? currentTurn.messages : [];
    if (ageMs === undefined) {
      unverified.push("Codex turn capture has invalid capturedAt.");
      risk.push("False Pass risk: Codex turn capture freshness cannot be verified.");
    } else if (ageMs < 0 || ageMs > turnMaxAge) {
      unverified.push("Codex turn capture is stale.");
      risk.push("False Pass risk: Codex turn capture is stale.");
    } else if (!sessionId || messages.length === 0) {
      unverified.push("Codex turn capture is malformed or empty.");
      risk.push("False Pass risk: Codex turn capture has no usable session messages.");
    } else {
      verified.push(`Fresh Codex turn capture is present for session ${sessionId} with ${messages.length} message(s).`);
    }
  }

  return { verified, weak, unverified, risk };
}

async function deriveTurnComplianceFindings(input: {
  repoPath: string;
  config: SidecarConfig;
  codexReport: string;
  hasDiff: boolean;
}): Promise<Pick<StaxGateStatus, "verified" | "weak" | "unverified" | "risk">> {
  const mode = input.config.turnComplianceMode ?? (input.config.requireFreshCodexTurnCapture ? "strict" : "normal");
  const compliance = await checkTurnCompliance({
    repoPath: input.repoPath,
    codexReportText: input.codexReport,
    mode,
    codexClaimsCompletion: /\b(done|complete|finished|ready)\b/i.test(input.codexReport),
    hasDiff: input.hasDiff
  });
  if (compliance.pass) {
    return {
      verified: [`Codex acknowledged current STAX turn contract: ${compliance.acknowledgement}`],
      weak: [],
      unverified: [],
      risk: []
    };
  }

  const weak = compliance.issues.filter((issue) => issue.severity === "weak").map((issue) => issue.message);
  const unverified = compliance.issues.filter((issue) => issue.severity === "reject").map((issue) => issue.message);
  const risk =
    unverified.length > 0
      ? ["False Pass risk: Codex did not prove it read the current STAX turn contract."]
      : [];
  return {
    verified: [],
    weak,
    unverified,
    risk
  };
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

async function writeSidecarStatus(repoPath: string, status: StaxGateStatus): Promise<void> {
  const staxPath = sidecarDir(repoPath);
  await ensureDirectory(staxPath);
  await fs.writeFile(path.join(staxPath, "status.md"), status.statusMarkdown, "utf8");
  const { statusMarkdown, ...jsonStatus } = status;
  await fs.writeFile(path.join(staxPath, "status.json"), `${JSON.stringify(jsonStatus, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(staxPath, "next-codex-prompt.md"),
    status.verdict === "Accept" ? "No correction prompt needed; the current sidecar gate is accepted.\n" : `${status.codexPrompt}\n`,
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
}): string {
  return [
    "## Verdict",
    `- Status: ${input.verdict}`,
    `- Why: ${input.why}`,
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
    "## One Next Action",
    `- ${input.oneNextAction}`,
    "",
    "## Codex Prompt if needed",
    input.codexPrompt
  ].join("\n") + "\n";
}

function renderBullets(items: string[], fallback: string): string[] {
  const source = items.length > 0 ? items : [fallback];
  return source.map((item) => `- ${item}`);
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
  if (!input.hasDiff && input.codexReport.trim().length === 0) return "Accept";
  if (input.risk.length > 0) return "Human review";
  if (input.weak.length > 0) return "Provisional";
  return "Accept";
}

function deriveWhy(verdict: StaxGateVerdict, weak: string[], unverified: string[], risk: string[]): string {
  if (verdict === "Accept") return "Sidecar gate found no unverified proof claim for the current repo state.";
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
  risk: string[]
): string {
  const combined = [...unverified, ...risk].join("\n").toLowerCase();
  if (verdict === "Accept") return "Continue with the normal repo workflow; no sidecar correction is needed.";
  if (!codexReport.trim()) return "Ask Codex to write .stax/codex-report.md using the required STAX report fields.";
  if (commandEvidenceEntries.length === 0 && /test|command|proof|exit code|passed/i.test(combined)) {
    return `Run npm run stax:collect -- --repo ${repoPath} -- npm test, or collect the repo's canonical proof command.`;
  }
  return "Ask Codex to address the first unverified proof gap and update .stax/codex-report.md with exact evidence.";
}

function deriveCodexPrompt(verdict: StaxGateVerdict, nextAction: string, unverified: string[], risk: string[]): string {
  if (verdict === "Accept") {
    return "Report the accepted STAX sidecar status, keep the scope unchanged, and stop.";
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
  const normalized = filePath.replace(/\\/g, "/");
  return normalized === "AGENTS.md" || normalized === ".gitignore" || normalized.startsWith(".stax/");
}

function deriveSidecarFindings(input: {
  hasDiff: boolean;
  changedFiles: ProjectControlChangedFile[];
  codexReport: string;
  commandEvidenceEntries: ProjectControlCommandEvidenceEntry[];
  repoPath: string;
  snapshot: { repoName: string; branch?: string; commitSha?: string };
}): Pick<StaxGateStatus, "verified" | "weak" | "unverified" | "risk"> {
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
  const riskyRelease = /\b(deploy|publish|sync|release|TestFlight|App Store|production)\b/i.test(report);
  const implementationClaim = /\b(implemented|fixed|done|complete|ready|works|behavior|runtime)\b/i.test(report);
  const testsPassedClaim = /\b(tests? passed|npm test passed|all tests passed|test suite passed)\b/i.test(report);

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
  if (visualChanged && /\b(visual|layout|css|screenshot|rendered|looks good)\b/i.test(report) && !/\b(screenshot|playwright|rendered preview)\b/i.test(report)) {
    unverified.push("Visual/style claim lacks rendered visual proof.");
    risk.push("Visual proof required before accepting UI/layout claims.");
  }
  if (riskyRelease && !/\b(approval|rollback|dry run|preflight|build passed)\b/i.test(report)) {
    unverified.push("Deploy/publish/sync/release claim lacks approval, rollback, or preflight proof.");
    risk.push("Unsafe publish/deploy/sync claim blocked.");
  }

  for (const entry of latestCommandEvidenceByCommand(input.commandEvidenceEntries)) {
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
      weak.push(`Command evidence commit ${entry.commitSha} differs from current head ${input.snapshot.commitSha}.`);
      risk.push("Stale command evidence must be refreshed for the current head.");
    }
    if (entry.exitCode !== 0) {
      unverified.push(`Command evidence failed: ${entry.command} exited ${entry.exitCode ?? "unknown"}.`);
    }
  }
  const supersededFailures = input.commandEvidenceEntries.filter((entry) => {
    if (entry.exitCode === 0) return false;
    const latest = latestCommandEvidenceByCommand(input.commandEvidenceEntries).find((item) => item.command === entry.command);
    return latest && latest !== entry && latest.exitCode === 0;
  });
  for (const entry of supersededFailures.slice(0, 2)) {
    weak.push(`Earlier failed command evidence exists but is superseded by a later passing ${entry.command} run.`);
  }

  return { verified, weak, unverified, risk };
}

async function readCommandEvidenceEntries(repoPath: string): Promise<ProjectControlCommandEvidenceEntry[]> {
  const dir = path.join(sidecarDir(repoPath), "command-evidence");
  const names = await fs.readdir(dir).catch(() => []);
  const entries: ProjectControlCommandEvidenceEntry[] = [];
  for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
    const filePath = path.join(dir, name);
    const raw = await readTextIfExists(filePath);
    if (!raw.trim()) continue;
    const parsed = JSON.parse(raw) as CommandEvidenceFile;
    const stdout = parsed.stdoutPath
      ? await readTextIfExists(path.isAbsolute(parsed.stdoutPath) ? parsed.stdoutPath : path.join(dir, parsed.stdoutPath))
      : parsed.stdout ?? "";
    const stderr = parsed.stderrPath
      ? await readTextIfExists(path.isAbsolute(parsed.stderrPath) ? parsed.stderrPath : path.join(dir, parsed.stderrPath))
      : parsed.stderr ?? "";
    entries.push({
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
      source: parsed.source ?? "local_stax_command_output"
    });
  }
  return sortCommandEvidenceNewestFirst(entries);
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

function sortCommandEvidenceNewestFirst(
  entries: ProjectControlCommandEvidenceEntry[]
): ProjectControlCommandEvidenceEntry[] {
  return [...entries].sort((a, b) => commandEvidenceTime(b) - commandEvidenceTime(a));
}

function latestCommandEvidenceByCommand(
  entries: ProjectControlCommandEvidenceEntry[]
): ProjectControlCommandEvidenceEntry[] {
  const latest = new Map<string, ProjectControlCommandEvidenceEntry>();
  for (const entry of sortCommandEvidenceNewestFirst(entries)) {
    if (!latest.has(entry.command)) latest.set(entry.command, entry);
  }
  return [...latest.values()];
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
  const claims: string[] = [];
  if (/\bimplemented|fixed|source|runtime\b/i.test(report)) claims.push("implementation");
  if (/\btest|spec|passed\b/i.test(report)) claims.push("test");
  if (/\bbehavior|works|ready\b/i.test(report)) claims.push("behavior");
  if (/\bvisual|layout|css|screenshot\b/i.test(report)) claims.push("visual");
  if (/\bdeploy|release|publish|sync\b/i.test(report)) claims.push("release_deploy");
  return dedupe(claims.length ? claims : ["unspecified"]);
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}
