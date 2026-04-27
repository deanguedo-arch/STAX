import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ModeRegistry, type ModeMaturityReport } from "../modes/ModeRegistry.js";

const execFileAsync = promisify(execFile);

export type LatestEvalEvidence = {
  path: string;
  total?: number;
  passed?: number;
  failed?: number;
  passRate?: number;
  criticalFailures?: number;
};

export type ProjectDocEvidence = {
  path: string;
  exists: boolean;
  excerpt?: string;
};

export type LocalEvidence = {
  gitStatus: string;
  gitDiffStat: string;
  gitDiffNameOnly: string[];
  latestEval?: LatestEvalEvidence;
  latestRunFolder?: string;
  projectDocs: ProjectDocEvidence[];
  modeMaturity: ModeMaturityReport[];
  errors: string[];
};

export type LocalEvidenceOptions = {
  includeProjectDocs?: boolean;
  includeModeMaturity?: boolean;
  includeLatestEval?: boolean;
  includeLatestRun?: boolean;
};

const PROJECT_DOCS = [
  "docs/PROJECT_STATE.md",
  "docs/DECISION_LOG.md",
  "docs/KNOWN_FAILURES.md",
  "docs/NEXT_ACTIONS.md",
  "docs/RISK_REGISTER.md",
  "docs/PROVEN_WORKING.md",
  "docs/UNPROVEN_CLAIMS.md",
  "docs/EVIDENCE_REGISTRY.md",
  "docs/CLAIM_LEDGER.md"
];

export async function collectLocalEvidence(
  rootDir = process.cwd(),
  options: LocalEvidenceOptions = {}
): Promise<LocalEvidence> {
  const errors: string[] = [];
  const [gitStatus, gitDiffStat, diffNameOnlyRaw] = await Promise.all([
    runGit(rootDir, ["status", "--short"], errors),
    runGit(rootDir, ["diff", "--stat"], errors),
    runGit(rootDir, ["diff", "--name-only"], errors)
  ]);

  const [latestEval, latestRunFolder, projectDocs, modeMaturity] = await Promise.all([
    options.includeLatestEval === false ? Promise.resolve(undefined) : readLatestEval(rootDir, errors),
    options.includeLatestRun === false ? Promise.resolve(undefined) : readLatestRunFolder(rootDir, errors),
    options.includeProjectDocs ? readProjectDocs(rootDir, errors) : Promise.resolve([]),
    options.includeModeMaturity ? new ModeRegistry(rootDir).maturity().catch((error: unknown) => {
      errors.push(`mode maturity unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }) : Promise.resolve([])
  ]);

  return {
    gitStatus: gitStatus.trim() || "(clean)",
    gitDiffStat: gitDiffStat.trim() || "(no unstaged diff)",
    gitDiffNameOnly: diffNameOnlyRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    latestEval,
    latestRunFolder,
    projectDocs,
    modeMaturity,
    errors
  };
}

export function formatLocalEvidence(evidence: LocalEvidence): string {
  return [
    "## Local Evidence",
    "",
    "### Git Status",
    fence(evidence.gitStatus),
    "",
    "### Git Diff Stat",
    fence(evidence.gitDiffStat),
    "",
    "### Git Diff Name Only",
    evidence.gitDiffNameOnly.length
      ? evidence.gitDiffNameOnly.map((file) => `- ${file}`).join("\n")
      : "- None",
    "",
    "### Latest Eval Result",
    evidence.latestEval
      ? [
          `- Path: ${evidence.latestEval.path}`,
          `- Total: ${evidence.latestEval.total ?? "unknown"}`,
          `- Passed: ${evidence.latestEval.passed ?? "unknown"}`,
          `- Failed: ${evidence.latestEval.failed ?? "unknown"}`,
          `- passRate: ${evidence.latestEval.passRate ?? "unknown"}`,
          `- Critical Failures: ${evidence.latestEval.criticalFailures ?? "unknown"}`
        ].join("\n")
      : "- No eval result found.",
    "",
    "### Latest Run Folder",
    evidence.latestRunFolder ? `- ${evidence.latestRunFolder}` : "- No run folder found.",
    "",
    ...(evidence.projectDocs.length
      ? [
          "### Project Docs",
          evidence.projectDocs
            .map((doc) => [
              `#### ${doc.path}`,
              doc.exists ? fence(doc.excerpt ?? "") : "- Missing"
            ].join("\n"))
            .join("\n\n"),
          ""
        ]
      : []),
    ...(evidence.modeMaturity.length
      ? [
          "### Mode Maturity",
          evidence.modeMaturity
            .map((entry) => `- ${entry.mode}: ${entry.maturity}; gaps=${entry.proofGaps.join(", ") || "none"}`)
            .join("\n"),
          ""
        ]
      : []),
    "### Evidence Collection Errors",
    evidence.errors.length ? evidence.errors.map((error) => `- ${error}`).join("\n") : "- None"
  ].join("\n");
}

async function runGit(rootDir: string, args: string[], errors: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", rootDir, ...args], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    if (stderr.trim()) errors.push(`git ${args.join(" ")} stderr: ${stderr.trim()}`);
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(
      message.includes("not a git repository")
        ? `git ${args.join(" ")} failed: not a git repository`
        : `git ${args.join(" ")} failed: ${message.split("\n")[0]}`
    );
    return "";
  }
}

async function readLatestEval(rootDir: string, errors: string[]): Promise<LatestEvalEvidence | undefined> {
  const dir = path.join(rootDir, "evals", "eval_results");
  try {
    const files = await fs.readdir(dir);
    const candidates = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const fullPath = path.join(dir, file);
          const stat = await fs.stat(fullPath);
          return { file, fullPath, mtimeMs: stat.mtimeMs };
        })
    );
    const latest = candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    if (!latest) return undefined;
    const parsed = JSON.parse(await fs.readFile(latest.fullPath, "utf8")) as Partial<LatestEvalEvidence>;
    return {
      path: path.relative(rootDir, latest.fullPath),
      total: parsed.total,
      passed: parsed.passed,
      failed: parsed.failed,
      passRate: parsed.passRate,
      criticalFailures: parsed.criticalFailures
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(`latest eval unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    return undefined;
  }
}

async function readLatestRunFolder(rootDir: string, errors: string[]): Promise<string | undefined> {
  const dir = path.join(rootDir, "runs");
  try {
    const dates = (await fs.readdir(dir)).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));
    const candidates: Array<{ relativePath: string; mtimeMs: number }> = [];
    for (const date of dates) {
      const dateDir = path.join(dir, date);
      for (const entry of await fs.readdir(dateDir)) {
        if (!entry.startsWith("run-")) continue;
        const fullPath = path.join(dateDir, entry);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          candidates.push({ relativePath: path.relative(rootDir, fullPath), mtimeMs: stat.mtimeMs });
        }
      }
    }
    return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.relativePath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(`latest run folder unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    return undefined;
  }
}

async function readProjectDocs(rootDir: string, errors: string[]): Promise<ProjectDocEvidence[]> {
  return Promise.all(
    PROJECT_DOCS.map(async (relativePath) => {
      try {
        const raw = await fs.readFile(path.join(rootDir, relativePath), "utf8");
        return {
          path: relativePath,
          exists: true,
          excerpt: raw.trim().slice(0, 1400)
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          errors.push(`${relativePath} unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
        return { path: relativePath, exists: false };
      }
    })
  );
}

function fence(content: string): string {
  return ["```txt", content.trim() || "(empty)", "```"].join("\n");
}
