import fs from "node:fs/promises";
import path from "node:path";
import { validateProjectControlCaptureOutput } from "./CaptureValidation.js";

export type ComparisonIntegrityIssue = {
  code:
    | "missing_required_file"
    | "invalid_manifest"
    | "corrupted_capture"
    | "missing_capture_output"
    | "missing_required_sections"
    | "task_mismatch"
    | "conflicting_score_files"
    | "stale_score_marked_current"
    | "report_score_mismatch";
  message: string;
};

export type ComparisonIntegrityResult = {
  pass: boolean;
  runId: string;
  runDir: string;
  issues: ComparisonIntegrityIssue[];
  summary?: {
    total: number;
    staxWins: number;
    chatgptWins: number;
    ties: number;
    staxCriticalMisses: number;
    chatgptCriticalMisses: number;
  };
};

type Manifest = {
  runId: string;
  createdAt: string;
  caseCount: number;
  staxSource: string;
  chatgptSource: string;
  scoringRubricVersion: string;
  criticalMissRulesVersion: string;
  canonicalScoresFile: string;
  canonicalReportFile: string;
};

type CasesFile = {
  cases: Array<{ taskId: string }>;
};

type CapturesFile = {
  captures: Array<{ taskId: string; staxOutput?: string; chatgptOutput?: string }>;
};

type ScoresFile = {
  entries: Array<{
    taskId: string;
    staxScore: number;
    chatgptScore: number;
    staxCriticalMiss: boolean;
    chatgptCriticalMiss: boolean;
    winner?: "stax" | "chatgpt" | "tie";
  }>;
};

const REQUIRED_FILES = ["cases.json", "captures.json", "scores.json", "report.md", "manifest.json"] as const;

function scoreSummary(entries: ScoresFile["entries"]) {
  let staxWins = 0;
  let chatgptWins = 0;
  let ties = 0;
  let staxCriticalMisses = 0;
  let chatgptCriticalMisses = 0;
  for (const entry of entries) {
    if (entry.staxCriticalMiss) staxCriticalMisses++;
    if (entry.chatgptCriticalMiss) chatgptCriticalMisses++;
    if (entry.staxCriticalMiss && !entry.chatgptCriticalMiss) {
      chatgptWins++;
      continue;
    }
    if (!entry.staxCriticalMiss && entry.chatgptCriticalMiss) {
      staxWins++;
      continue;
    }
    if (entry.winner === "stax") {
      staxWins++;
      continue;
    }
    if (entry.winner === "chatgpt") {
      chatgptWins++;
      continue;
    }
    if (entry.winner === "tie") {
      ties++;
      continue;
    }
    const delta = entry.staxScore - entry.chatgptScore;
    if (delta >= 2) staxWins++;
    else if (delta <= -2) chatgptWins++;
    else ties++;
  }
  return {
    total: entries.length,
    staxWins,
    chatgptWins,
    ties,
    staxCriticalMisses,
    chatgptCriticalMisses
  };
}

function parseReportSummary(report: string) {
  function n(re: RegExp) {
    const m = report.match(re);
    return m ? Number(m[1]) : null;
  }
  return {
    total: n(/Total scored cases:\s*(\d+)/i),
    staxWins: n(/STAX wins:\s*(\d+)/i),
    chatgptWins: n(/ChatGPT wins:\s*(\d+)/i),
    ties: n(/Ties:\s*(\d+)/i),
    staxCriticalMisses: n(/STAX critical misses:\s*(\d+)/i),
    chatgptCriticalMisses: n(/ChatGPT critical misses:\s*(\d+)/i)
  };
}

export async function validateComparisonRunIntegrity(input: {
  runId: string;
  baseDir?: string;
}): Promise<ComparisonIntegrityResult> {
  const baseDir = input.baseDir ?? path.join(process.cwd(), "fixtures", "real_use", "runs");
  const runDir = path.join(baseDir, input.runId);
  const issues: ComparisonIntegrityIssue[] = [];

  for (const filename of REQUIRED_FILES) {
    try {
      await fs.access(path.join(runDir, filename));
    } catch {
      issues.push({
        code: "missing_required_file",
        message: `Missing required file: ${filename}`
      });
    }
  }
  if (issues.length > 0) {
    return { pass: false, runId: input.runId, runDir, issues };
  }

  const manifest = JSON.parse(
    await fs.readFile(path.join(runDir, "manifest.json"), "utf8")
  ) as Manifest;
  if (
    manifest.runId !== input.runId ||
    manifest.canonicalScoresFile !== "scores.json" ||
    manifest.canonicalReportFile !== "report.md"
  ) {
    issues.push({
      code: "invalid_manifest",
      message: "Manifest runId or canonical file pointers are invalid."
    });
  }

  const siblingFiles = await fs.readdir(runDir);
  const extraScoreFiles = siblingFiles.filter((file) => /score/i.test(file) && file !== "scores.json");
  if (extraScoreFiles.length > 0) {
    issues.push({
      code: "conflicting_score_files",
      message: `Conflicting score-like files found: ${extraScoreFiles.join(", ")}`
    });
  }

  for (const file of extraScoreFiles) {
    if (file.endsWith(".json")) {
      const raw = await fs.readFile(path.join(runDir, file), "utf8");
      if (/"isCurrent"\s*:\s*true/.test(raw)) {
        issues.push({
          code: "stale_score_marked_current",
          message: `Stale score file marked current: ${file}`
        });
      }
    }
  }

  const cases = JSON.parse(await fs.readFile(path.join(runDir, "cases.json"), "utf8")) as CasesFile;
  const captures = JSON.parse(await fs.readFile(path.join(runDir, "captures.json"), "utf8")) as CapturesFile;
  const scores = JSON.parse(await fs.readFile(path.join(runDir, "scores.json"), "utf8")) as ScoresFile;
  const report = await fs.readFile(path.join(runDir, "report.md"), "utf8");

  const caseTaskIds = new Set(cases.cases.map((c) => c.taskId));
  const captureTaskIds = new Set(captures.captures.map((c) => c.taskId));
  const scoreTaskIds = new Set(scores.entries.map((s) => s.taskId));
  for (const taskId of caseTaskIds) {
    if (!captureTaskIds.has(taskId) || !scoreTaskIds.has(taskId)) {
      issues.push({
        code: "task_mismatch",
        message: `Task missing in captures or scores: ${taskId}`
      });
    }
  }

  for (const capture of captures.captures) {
    const staxValidation = validateProjectControlCaptureOutput(capture.staxOutput);
    const chatgptValidation = validateProjectControlCaptureOutput(capture.chatgptOutput);
    if (staxValidation.issues.includes("missing_output") || chatgptValidation.issues.includes("missing_output")) {
      issues.push({
        code: "missing_capture_output",
        message: `Missing STAX/ChatGPT output for task ${capture.taskId}`
      });
      continue;
    }
    if (staxValidation.issues.includes("operational_capture_text") || chatgptValidation.issues.includes("operational_capture_text")) {
      issues.push({
        code: "corrupted_capture",
        message: `Operational capture text found in task ${capture.taskId}`
      });
    }
    if (staxValidation.issues.includes("missing_required_sections") || chatgptValidation.issues.includes("missing_required_sections")) {
      issues.push({
        code: "missing_required_sections",
        message: `Required sections missing in task ${capture.taskId}`
      });
    }
  }

  const expected = scoreSummary(scores.entries);
  const reported = parseReportSummary(report);
  const mismatch =
    reported.total !== expected.total ||
    reported.staxWins !== expected.staxWins ||
    reported.chatgptWins !== expected.chatgptWins ||
    reported.ties !== expected.ties ||
    reported.staxCriticalMisses !== expected.staxCriticalMisses ||
    reported.chatgptCriticalMisses !== expected.chatgptCriticalMisses;
  if (mismatch) {
    issues.push({
      code: "report_score_mismatch",
      message: "Report summary does not match canonical scores.json summary."
    });
  }

  return {
    pass: issues.length === 0,
    runId: input.runId,
    runDir,
    issues,
    summary: expected
  };
}
