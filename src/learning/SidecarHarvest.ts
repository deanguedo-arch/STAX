import fs from "node:fs/promises";
import path from "node:path";
import { SidecarLearningEventSchema, type SidecarLearningEvent } from "../sidecar/SidecarLearningEvent.js";
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
} from "../sidecar/SidecarRepo.js";
import type { SidecarImportCandidate } from "./SidecarImportCandidate.js";

export type SidecarHarvestResult = {
  sourceRepoPath: string;
  imported: number;
  skippedPrivacyBlocked: number;
  skippedTraceEvents: number;
  skippedNonLearningEvents: number;
  skippedInvalidEvents: number;
  skippedEvents: Array<{
    eventFile: string;
    reason: "trace_only" | "non_learning_schema" | "invalid_learning_event" | "invalid_json";
    schemaVersion?: string;
    eventType?: string;
  }>;
  pendingDir: string;
  candidates: SidecarImportCandidate[];
};

export async function harvestSidecarEvents(options: {
  fromRepoPath: string;
  staxRoot?: string;
  sessionsRoot?: string;
}): Promise<SidecarHarvestResult> {
  const sourceRepoPath = await validateRepoPath(options.fromRepoPath);
  const staxRoot = path.resolve(options.staxRoot ?? process.cwd());
  const eventsDir = path.join(sidecarDir(sourceRepoPath), "events");
  const pendingDir = path.join(staxRoot, "queues", "sidecar_imports", "pending");
  await ensureDirectory(pendingDir);
  const eventFiles = (await fs.readdir(eventsDir).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const candidates: SidecarImportCandidate[] = [];
  let skippedPrivacyBlocked = 0;
  let skippedTraceEvents = 0;
  let skippedNonLearningEvents = 0;
  let skippedInvalidEvents = 0;
  const skippedEvents: SidecarHarvestResult["skippedEvents"] = [];

  for (const eventFile of eventFiles) {
    const raw = await readTextIfExists(path.join(eventsDir, eventFile));
    if (!raw.trim()) continue;
    const parsedJson = parseJsonObject(raw);
    if (!parsedJson) {
      skippedInvalidEvents += 1;
      skippedEvents.push({ eventFile, reason: "invalid_json" });
      continue;
    }
    const eventResult = SidecarLearningEventSchema.safeParse(parsedJson);
    if (!eventResult.success) {
      const schemaVersion = asText(parsedJson.schemaVersion);
      const eventType = asText(parsedJson.eventType);
      if (schemaVersion && schemaVersion !== "sidecar-learning-v1") {
        skippedNonLearningEvents += 1;
        skippedEvents.push({ eventFile, reason: "non_learning_schema", schemaVersion, eventType });
      } else {
        skippedInvalidEvents += 1;
        skippedEvents.push({ eventFile, reason: "invalid_learning_event", schemaVersion, eventType });
      }
      continue;
    }
    const event = eventResult.data;
    if (event.privacy.redactionStatus === "blocked") {
      skippedPrivacyBlocked += 1;
      continue;
    }
    if (event.promotion.target === "none") {
      skippedTraceEvents += 1;
      skippedEvents.push({ eventFile, reason: "trace_only", schemaVersion: event.schemaVersion, eventType: event.eventType });
      continue;
    }
    const candidate = candidateFromEvent(event);
    if (await writeCandidateIfNew(staxRoot, pendingDir, candidate)) {
      candidates.push(candidate);
    }
  }

  const statusCandidates = await candidatesFromSidecarStatus({ sourceRepoPath });
  for (const candidate of statusCandidates) {
    if (await writeCandidateIfNew(staxRoot, pendingDir, candidate)) {
      candidates.push(candidate);
    }
  }

  const reportCandidates = await candidatesFromCodexReports({
    sourceRepoPath,
    sessionsRoot: options.sessionsRoot
  });
  for (const candidate of reportCandidates) {
    if (await writeCandidateIfNew(staxRoot, pendingDir, candidate)) {
      candidates.push(candidate);
    }
  }

  return {
    sourceRepoPath,
    imported: candidates.length,
    skippedPrivacyBlocked,
    skippedTraceEvents,
    skippedNonLearningEvents,
    skippedInvalidEvents,
    skippedEvents,
    pendingDir,
    candidates
  };
}

async function writeCandidateIfNew(staxRoot: string, pendingDir: string, candidate: SidecarImportCandidate): Promise<boolean> {
  if (await candidateAlreadyExists(staxRoot, candidate.candidateId)) return false;
  const candidatePath = path.join(pendingDir, `${candidate.candidateId}.json`);
  await fs.writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return true;
}

async function candidateAlreadyExists(staxRoot: string, candidateId: string): Promise<boolean> {
  const roots = [
    path.join(staxRoot, "queues", "sidecar_imports", "pending"),
    path.join(staxRoot, "queues", "sidecar_imports", "promoted"),
    path.join(staxRoot, "queues", "sidecar_imports", "rejected")
  ];
  for (const root of roots) {
    try {
      await fs.access(path.join(root, `${candidateId}.json`));
      return true;
    } catch {
      // Candidate not present in this queue state.
    }
  }
  return false;
}

type CodexReportCandidateInput = {
  sourceRepoPath: string;
  sessionsRoot?: string;
};

type SidecarStatusCandidateInput = {
  sourceRepoPath: string;
};

type ParsedCodexReport = {
  objective: string;
  filesChanged: string;
  testsAdded: string;
  commandsRun: string;
  commandOutputSummary: string;
  verified: string;
  weakProvisional: string;
  unverified: string;
  risks: string;
  oneNextAction: string;
};

type ReportSource = {
  sourceKind: "codex_report" | "codex_session_report";
  reportText: string;
  sourcePath?: string;
  sessionId?: string;
  eventTimestamp?: string;
};

type SidecarStatusSnapshot = {
  generatedAt?: string;
  repo?: string;
  repoPath?: string;
  branch?: string;
  commitSha?: string;
  task?: string;
  verdict?: string;
  why?: string;
  verified?: string[];
  weak?: string[];
  unverified?: string[];
  risk?: string[];
  oneNextAction?: string;
  proofStrength?: {
    claimType?: string;
    label?: string;
    finalScore?: number;
    primaryLimiter?: string;
    capApplied?: Array<string | { id?: string; reason?: string }>;
  };
  protocolStatus?: string;
};

async function candidatesFromSidecarStatus(input: SidecarStatusCandidateInput): Promise<SidecarImportCandidate[]> {
  const raw = await readTextIfExists(path.join(sidecarDir(input.sourceRepoPath), "status.json"));
  if (!raw.trim()) return [];
  const parsed = parseJsonObject(raw);
  if (!parsed) return [];
  const status = normalizeStatusSnapshot(parsed);
  const lessons = observedLessonsFromStatus(status);
  if (lessons.length === 0) return [];
  const repoName = status.repo || path.basename(input.sourceRepoPath);
  const sourcePath = status.repoPath || input.sourceRepoPath;
  const statusHash = shortHash(
    JSON.stringify({
      generatedAt: status.generatedAt,
      task: status.task,
      verdict: status.verdict,
      why: status.why,
      lessons
    })
  );
  const candidateId = `cand_${sanitizeId(`${repoName}_sidecar_status_${statusHash}`)}`;
  const text = sidecarStatusText(status);
  const isCourseDeploy = /course|google-hosted|firebase|hosting|forensics|psychology|canvas-helper|deploy/i.test(text);
  const redactedLessons = lessons.map(redactText);
  return [
    {
      candidateId,
      sourceEventId: `sidecar_status_${statusHash}`,
      sourceRepo: {
        name: repoName,
        pathHash: sha256(path.resolve(sourcePath)),
        branch: status.branch,
        commitSha: status.commitSha
      },
      candidateType: "regression_eval",
      scope: isCourseDeploy ? "archetype" : "global",
      summary: `Sidecar status from ${repoName}: ${redactedLessons.join(" ")}`,
      proposedArtifact: {
        destinationHint: destinationHintFor("regression_eval"),
        payload: {
          sourceKind: "sidecar_status",
          sourcePath: ".stax/status.json",
          generatedAt: status.generatedAt,
          repo: repoName,
          verdict: status.verdict,
          proofStrength: status.proofStrength,
          protocolStatus: status.protocolStatus,
          observedLessons: redactedLessons,
          suggestedRegressionEval: isCourseDeploy
            ? "A course deploy claim must require source workspace proof, export regeneration, STAX-collected deploy evidence, live target verification, and rendered visual proof."
            : "A rejected sidecar status with proof gaps must produce a bounded next proof action instead of being treated as accepted."
        }
      },
      requiresHumanApproval: true,
      status: "pending",
      privacy: {
        redactionStatus: redactedLessons.some((lesson, index) => lesson !== lessons[index]) ? "redacted" : "clean",
        redactionNotes: redactedLessons.some((lesson, index) => lesson !== lessons[index])
          ? ["URLs or secret-like values were redacted from sidecar status lessons."]
          : []
      },
      createdAt: nowIso()
    }
  ];
}

function normalizeStatusSnapshot(raw: Record<string, unknown>): SidecarStatusSnapshot {
  const proofStrength = raw.proofStrength && typeof raw.proofStrength === "object" && !Array.isArray(raw.proofStrength)
    ? (raw.proofStrength as Record<string, unknown>)
    : undefined;
  return {
    generatedAt: asText(raw.generatedAt),
    repo: asText(raw.repo),
    repoPath: asText(raw.repoPath),
    branch: asText(raw.branch),
    commitSha: asText(raw.commitSha),
    task: asText(raw.task),
    verdict: asText(raw.verdict),
    why: asText(raw.why),
    verified: asStringArray(raw.verified),
    weak: asStringArray(raw.weak),
    unverified: asStringArray(raw.unverified),
    risk: asStringArray(raw.risk),
    oneNextAction: asText(raw.oneNextAction),
    proofStrength: proofStrength
      ? {
          claimType: asText(proofStrength.claimType),
          label: asText(proofStrength.label),
          finalScore: typeof proofStrength.finalScore === "number" ? proofStrength.finalScore : undefined,
          primaryLimiter: asText(proofStrength.primaryLimiter),
          capApplied: Array.isArray(proofStrength.capApplied)
            ? proofStrength.capApplied.filter((item): item is string | { id?: string; reason?: string } => typeof item === "string" || (typeof item === "object" && item !== null))
            : []
        }
      : undefined,
    protocolStatus: asText(raw.protocolStatus)
  };
}

function observedLessonsFromStatus(status: SidecarStatusSnapshot): string[] {
  const text = sidecarStatusText(status);
  const lessons: string[] = [];
  if (/course|google-hosted|firebase|hosting|forensics|psychology|canvas-helper|deploy/.test(text) && /release|deploy|target|live|visual/.test(text)) {
    lessons.push("Course deploy claims need a dedicated proof contract: workspace source change, export regeneration, STAX-collected deploy command, live target verification, and rendered visual proof.");
  }
  if (/visual|screenshot|rendered/.test(text)) {
    lessons.push("Visual/course behavior claims should require rendered screenshot or checklist proof; source or CSS diffs alone are not enough.");
  }
  if (/wrong_worktree|wrong worktree|wrong_commit|wrong commit|stale command|command evidence.*stale/.test(text)) {
    lessons.push("Stale, wrong-worktree, or wrong-commit command evidence must stay historical and cannot prove the current task.");
  }
  if (/local stax command label|unverified_local_command_provenance|human-pasted|human pasted/.test(text)) {
    lessons.push("Command output is strong proof only when collected through verified STAX command evidence for the target repo/worktree.");
  }
  if (/stax acknowledgement|current turn capture|protocolstatus.*failure|protocol failure/.test(text)) {
    lessons.push("Sidecar protocol timing should distinguish a missing acknowledgement from a capture-lag warning when the report contains the current ACK.");
  }
  if (/unsupported file_path|workspace\/export|proof\/protocol|behavior\/source\/release|https?:\/\//.test(text)) {
    lessons.push("Claim parsing should not treat URLs, prose slash phrases, or proof taxonomy labels as repo file-path claims.");
  }
  if (/external image|remote image|image source|lms|wikimedia|googleusercontent/.test(text)) {
    lessons.push("Course image fixes should prefer approved local assets or explicit placeholder removal proof over remote image sources.");
  }
  return [...new Set(lessons)];
}

function sidecarStatusText(status: SidecarStatusSnapshot): string {
  return [
    status.task,
    status.verdict,
    status.why,
    ...(status.verified ?? []),
    ...(status.weak ?? []),
    ...(status.unverified ?? []),
    ...(status.risk ?? []),
    status.oneNextAction,
    status.proofStrength?.claimType,
    status.proofStrength?.label,
    status.proofStrength?.primaryLimiter,
    ...(status.proofStrength?.capApplied ?? []).map((cap) => (typeof cap === "string" ? cap : `${cap.id ?? ""} ${cap.reason ?? ""}`)),
    status.protocolStatus
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

async function candidatesFromCodexReports(input: CodexReportCandidateInput): Promise<SidecarImportCandidate[]> {
  const snapshot = await collectGitSnapshot(input.sourceRepoPath);
  const sourceRepo = {
    name: snapshot.repoName,
    pathHash: sha256(path.resolve(input.sourceRepoPath)),
    branch: snapshot.branch,
    commitSha: snapshot.commitSha
  };
  const reports: ReportSource[] = [];
  const currentReport = await readTextIfExists(path.join(sidecarDir(input.sourceRepoPath), "codex-report.md"));
  if (currentReport.trim()) {
    reports.push({
      sourceKind: "codex_report",
      reportText: currentReport,
      sourcePath: ".stax/codex-report.md"
    });
  }
  if (input.sessionsRoot) {
    reports.push(...(await reportSourcesFromSessionLogs(input.sourceRepoPath, input.sessionsRoot)));
  }

  const candidates: SidecarImportCandidate[] = [];
  const seenIds = new Set<string>();
  for (const report of reports) {
    const parsed = parseCodexReport(report.reportText);
    if (!parsed.objective) continue;
    const redacted = redactReportSections(parsed);
    const reportHash = shortHash(normalizeReportText(report.reportText));
    const candidateId = `cand_${sanitizeId(`${sourceRepo.name}_codex_report_${reportHash}`)}`;
    if (seenIds.has(candidateId)) continue;
    seenIds.add(candidateId);
    candidates.push({
      candidateId,
      sourceEventId: `${report.sourceKind}_${reportHash}`,
      sourceRepo,
      candidateType: "repo_memory",
      scope: "repo",
      summary: summarizeCodexReport(sourceRepo.name, redacted.sections),
      proposedArtifact: {
        destinationHint: destinationHintFor("repo_memory"),
        payload: {
          sourceKind: report.sourceKind,
          sourcePath: report.sourcePath,
          sessionId: report.sessionId,
          eventTimestamp: report.eventTimestamp,
          reportHash: sha256(normalizeReportText(report.reportText)),
          sections: redacted.sections
        }
      },
      requiresHumanApproval: true,
      status: "pending",
      privacy: {
        redactionStatus: redacted.redacted ? "redacted" : "clean",
        redactionNotes: redacted.redacted ? ["URLs or secret-like values were redacted from report sections."] : []
      },
      createdAt: nowIso()
    });
  }
  return candidates;
}

function parseCodexReport(reportText: string): ParsedCodexReport {
  const sections = parseReportSections(reportText);
  return {
    objective: sections.objective ?? "",
    filesChanged: sections.filesChanged ?? "",
    testsAdded: sections.testsAdded ?? "",
    commandsRun: sections.commandsRun ?? "",
    commandOutputSummary: sections.commandOutputSummary ?? "",
    verified: sections.verified ?? "",
    weakProvisional: sections.weakProvisional ?? "",
    unverified: sections.unverified ?? "",
    risks: sections.risks ?? "",
    oneNextAction: sections.oneNextAction ?? ""
  };
}

const REPORT_HEADING_KEYS = new Map<string, keyof ParsedCodexReport>([
  ["objective", "objective"],
  ["files changed", "filesChanged"],
  ["tests added", "testsAdded"],
  ["commands run", "commandsRun"],
  ["command output summary with exit codes", "commandOutputSummary"],
  ["what is verified", "verified"],
  ["what is weak/provisional", "weakProvisional"],
  ["what is weak / provisional", "weakProvisional"],
  ["what is unverified", "unverified"],
  ["risks", "risks"],
  ["one next action", "oneNextAction"]
]);

function parseReportSections(reportText: string): Partial<ParsedCodexReport> {
  const sections: Partial<Record<keyof ParsedCodexReport, string[]>> = {};
  let active: keyof ParsedCodexReport | undefined;
  for (const line of reportText.replace(/\r\n/g, "\n").split("\n")) {
    const heading = reportHeadingKey(line);
    if (heading) {
      active = heading;
      sections[active] ??= [];
      continue;
    }
    if (active) sections[active]!.push(line);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()])
  ) as Partial<ParsedCodexReport>;
}

function reportHeadingKey(line: string): keyof ParsedCodexReport | undefined {
  const normalized = line
    .replace(/^#{1,6}\s*/, "")
    .replace(/:$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return REPORT_HEADING_KEYS.get(normalized);
}

function summarizeCodexReport(repoName: string, report: ParsedCodexReport): string {
  const next = report.oneNextAction ? ` Next: ${oneLine(report.oneNextAction)}` : "";
  return `Codex report from ${repoName}: ${oneLine(report.objective)}.${next}`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeReportText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function redactReportSections(sections: ParsedCodexReport): { sections: ParsedCodexReport; redacted: boolean } {
  let redacted = false;
  const entries = Object.entries(sections).map(([key, value]) => {
    const next = redactText(value);
    if (next !== value) redacted = true;
    return [key, next];
  });
  return {
    sections: Object.fromEntries(entries) as ParsedCodexReport,
    redacted
  };
}

function redactText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

async function reportSourcesFromSessionLogs(sourceRepoPath: string, sessionsRoot: string): Promise<ReportSource[]> {
  const sessionFiles = await listJsonlFiles(path.resolve(sessionsRoot));
  const repoPath = path.resolve(sourceRepoPath).toLowerCase();
  const reportPath = path.join(path.resolve(sourceRepoPath), ".stax", "codex-report.md").toLowerCase();
  const reports: ReportSource[] = [];
  for (const sessionFile of sessionFiles) {
    let activeCwd = "";
    let sessionId = path.basename(sessionFile, ".jsonl");
    const lines = (await readTextIfExists(sessionFile)).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const event = parseJsonObject(line);
      if (!event) continue;
      const payload = asRecord(event.payload);
      if (event.type === "session_meta") {
        sessionId = asText(payload?.id ?? payload?.sessionId) || sessionId;
        continue;
      }
      if (event.type === "turn_context") {
        activeCwd = path.resolve(asText(payload?.cwd)).toLowerCase();
        continue;
      }
      if (event.type !== "event_msg" || payload?.type !== "patch_apply_end") continue;
      const changes = payload?.changes;
      if (!changes || typeof changes !== "object" || Array.isArray(changes)) continue;
      for (const [changedPath, change] of Object.entries(changes)) {
        const normalizedChangedPath = path.resolve(changedPath).toLowerCase();
        const changedReport = normalizedChangedPath === reportPath;
        const activeRepo = activeCwd === repoPath;
        if (!changedReport && !activeRepo) continue;
        const content = typeof (change as { content?: unknown }).content === "string" ? (change as { content: string }).content : "";
        if (!content.trim()) continue;
        reports.push({
          sourceKind: "codex_session_report",
          reportText: content,
          sourcePath: path.basename(sessionFile),
          sessionId,
          eventTimestamp: asText(event.timestamp)
        });
      }
    }
  }
  return reports;
}

async function listJsonlFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function parseJsonObject(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function candidateFromEvent(event: SidecarLearningEvent): SidecarImportCandidate {
  const candidateType = event.promotion.target;
  const candidateId = `cand_${sanitizeId(`${event.sourceRepo.name}_${event.eventId}_${shortHash(JSON.stringify(event.evidence))}`)}`;
  return {
    candidateId,
    sourceEventId: event.eventId,
    sourceRepo: event.sourceRepo,
    candidateType,
    scope: event.promotion.scope,
    summary: summarizeEvent(event),
    proposedArtifact:
      candidateType === "none"
        ? undefined
        : {
            destinationHint: destinationHintFor(candidateType),
            payload: {
              eventType: event.eventType,
              task: event.task,
              stax: event.stax,
              evidence: event.evidence,
              rationale: event.promotion.rationale
            }
          },
    requiresHumanApproval: true,
    status: "pending",
    privacy: event.privacy,
    createdAt: nowIso()
  };
}

function summarizeEvent(event: SidecarLearningEvent): string {
  const patterns = event.evidence.failurePatternIds.length
    ? ` Patterns: ${event.evidence.failurePatternIds.join(", ")}.`
    : "";
  return `${event.eventType} from ${event.sourceRepo.name}: ${event.task.finalOutcome || event.stax.verdict}.${patterns}`;
}

function destinationHintFor(candidateType: SidecarImportCandidate["candidateType"]): string {
  const base = {
    regression_eval: "evals/candidates/",
    redteam_eval: "evals/candidates/redteam/",
    failure_pattern: "fixtures/failure_patterns/candidates/",
    repo_archetype_rule: "fixtures/repo_transfer/archetype_candidates/",
    repo_memory: "memory/candidates/",
    validator_patch: "patches/candidates/",
    prompt_template: "prompts/candidates/",
    none: "queues/sidecar_imports/pending/"
  } satisfies Record<SidecarImportCandidate["candidateType"], string>;
  return base[candidateType];
}
