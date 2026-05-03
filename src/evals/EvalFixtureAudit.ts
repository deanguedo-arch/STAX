import fs from "node:fs/promises";
import path from "node:path";

type EvalFixtureJson = {
  id?: unknown;
  mode?: unknown;
  forbiddenPatterns?: unknown;
};

export type EvalFixtureAuditIssue = {
  file: string;
  fixtureId: string;
  message: string;
};

export type EvalFixtureAuditSummary = {
  checkedFiles: number;
  issueCount: number;
  issues: EvalFixtureAuditIssue[];
};

const DEFAULT_FOLDERS = ["cases", "redteam", "regression"] as const;

const BROAD_PROJECT_CONTROL_FORBIDDEN = new Set([
  "complete",
  "completed",
  "done",
  "fixed",
  "fix",
  "approve",
  "approved",
  "ready",
  "pass",
  "passed",
  "success",
  "successful"
]);

function isSimpleToken(pattern: string): boolean {
  return /^[a-z-]+$/i.test(pattern);
}

function parseForbiddenPatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function fixtureIdOrFallback(filePath: string, parsed: EvalFixtureJson): string {
  if (typeof parsed.id === "string" && parsed.id.trim().length > 0) return parsed.id.trim();
  return path.basename(filePath, ".json");
}

export function auditEvalFixture(filePath: string, parsed: EvalFixtureJson): EvalFixtureAuditIssue[] {
  const fixtureId = fixtureIdOrFallback(filePath, parsed);
  const mode = typeof parsed.mode === "string" ? parsed.mode.trim() : "";
  const patterns = parseForbiddenPatterns(parsed.forbiddenPatterns);
  const issues: EvalFixtureAuditIssue[] = [];

  if (mode !== "project_control") return issues;

  for (const pattern of patterns) {
    const normalized = pattern.toLowerCase();
    if (isSimpleToken(normalized) && BROAD_PROJECT_CONTROL_FORBIDDEN.has(normalized)) {
      issues.push({
        file: filePath,
        fixtureId,
        message: `forbidden pattern '${pattern}' is too broad for project_control; use a precise phrase`
      });
    }
  }

  return issues;
}

export async function auditEvalFixtures(args: {
  rootDir?: string;
  folders?: readonly string[];
} = {}): Promise<EvalFixtureAuditSummary> {
  const rootDir = args.rootDir ?? process.cwd();
  const folders = args.folders ?? DEFAULT_FOLDERS;
  const issues: EvalFixtureAuditIssue[] = [];
  let checkedFiles = 0;

  for (const folder of folders) {
    const evalFolder = path.join(rootDir, "evals", folder);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(evalFolder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const fullPath = path.join(evalFolder, entry);
      checkedFiles += 1;
      let parsed: EvalFixtureJson;
      try {
        parsed = JSON.parse(await fs.readFile(fullPath, "utf8")) as EvalFixtureJson;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        issues.push({
          file: fullPath,
          fixtureId: path.basename(entry, ".json"),
          message: `invalid json: ${message}`
        });
        continue;
      }
      issues.push(...auditEvalFixture(fullPath, parsed));
    }
  }

  return {
    checkedFiles,
    issueCount: issues.length,
    issues
  };
}
