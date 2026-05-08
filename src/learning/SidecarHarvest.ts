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

  for (const eventFile of eventFiles) {
    const raw = await readTextIfExists(path.join(eventsDir, eventFile));
    if (!raw.trim()) continue;
    const event = SidecarLearningEventSchema.parse(JSON.parse(raw));
    if (event.privacy.redactionStatus === "blocked") {
      skippedPrivacyBlocked += 1;
      continue;
    }
    const candidate = candidateFromEvent(event);
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
      if (event.type === "session_meta") {
        sessionId = asText(event.payload?.id ?? event.payload?.sessionId) || sessionId;
        continue;
      }
      if (event.type === "turn_context") {
        activeCwd = path.resolve(asText(event.payload?.cwd)).toLowerCase();
        continue;
      }
      if (event.type !== "event_msg" || event.payload?.type !== "patch_apply_end") continue;
      const changes = event.payload?.changes;
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

function parseJsonObject(line: string): { type?: string; timestamp?: unknown; payload?: Record<string, unknown> } | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as { type?: string; timestamp?: unknown; payload?: Record<string, unknown> };
  } catch {
    return undefined;
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
