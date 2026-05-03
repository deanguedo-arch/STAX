import { classifyFileRole } from "./DiffAudit.js";
import type { DiffChangeType, DiffFileRole } from "./DiffAuditSchemas.js";
import fs from "node:fs/promises";
import path from "node:path";

export type ParsedUnifiedDiffHunk = {
  header: string;
  addedLines: number;
  deletedLines: number;
};

export type ParsedUnifiedDiffFile = {
  path: string;
  oldPath?: string;
  newPath?: string;
  changeType: DiffChangeType;
  fileRole: DiffFileRole;
  addedLines: number;
  deletedLines: number;
  isBinary: boolean;
  isRename: boolean;
  isCopy: boolean;
  modeChanged: boolean;
  hunks: ParsedUnifiedDiffHunk[];
  patch: string;
};

export type UnifiedDiffFixtureCase = {
  caseId: string;
  description: string;
  diff: string;
  expected: {
    path: string;
    changeType: DiffChangeType;
    fileRole: DiffFileRole;
    oldPath?: string;
    newPath?: string;
    isBinary?: boolean;
    isRename?: boolean;
    isCopy?: boolean;
    modeChanged?: boolean;
  };
};

export function parseUnifiedDiff(input: string): ParsedUnifiedDiffFile[] {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");
  const files: ParsedUnifiedDiffFile[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index]?.startsWith("diff --git ")) {
      index += 1;
      continue;
    }

    const blockStart = index;
    const headerLine = lines[index]!;
    index += 1;

    while (index < lines.length && !lines[index]?.startsWith("diff --git ")) {
      index += 1;
    }

    const blockLines = lines.slice(blockStart, index);
    const parsed = parseDiffBlock(headerLine, blockLines);
    if (parsed) files.push(parsed);
  }

  return files;
}

export async function loadUnifiedDiffFixtureCases(rootDir = process.cwd()): Promise<UnifiedDiffFixtureCase[]> {
  const fixturePath = path.join(rootDir, "fixtures", "diff_audit", "unified_diff_cases.json");
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf8")) as { cases?: UnifiedDiffFixtureCase[] };
  return Array.isArray(raw.cases) ? raw.cases : [];
}

function parseDiffBlock(headerLine: string, blockLines: string[]): ParsedUnifiedDiffFile | undefined {
  const headerMatch = headerLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
  if (!headerMatch) return undefined;

  let oldPath = normalizeDiffPath(headerMatch[1]);
  let newPath = normalizeDiffPath(headerMatch[2]);
  let isBinary = false;
  let isRename = false;
  let isCopy = false;
  let modeChanged = false;
  const hunks: ParsedUnifiedDiffHunk[] = [];
  let addedLines = 0;
  let deletedLines = 0;

  for (const line of blockLines.slice(1)) {
    if (
      line.startsWith("old mode ") ||
      line.startsWith("new mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("new file mode ")
    ) {
      modeChanged = true;
    }
    if (line.startsWith("rename from ")) {
      isRename = true;
      oldPath = normalizeDiffPath(line.slice("rename from ".length));
    } else if (line.startsWith("rename to ")) {
      newPath = normalizeDiffPath(line.slice("rename to ".length));
    } else if (line.startsWith("copy from ")) {
      isCopy = true;
      oldPath = normalizeDiffPath(line.slice("copy from ".length));
    } else if (line.startsWith("copy to ")) {
      newPath = normalizeDiffPath(line.slice("copy to ".length));
    } else if (line.startsWith("--- ")) {
      oldPath = normalizePatchMarker(line.slice(4), oldPath);
    } else if (line.startsWith("+++ ")) {
      newPath = normalizePatchMarker(line.slice(4), newPath);
    } else if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      isBinary = true;
    } else if (line.startsWith("@@")) {
      const hunk = parseHunkHeader(line);
      hunks.push(hunk);
      addedLines += hunk.addedLines;
      deletedLines += hunk.deletedLines;
    }
  }

  const changeType = deriveChangeType(oldPath, newPath, isRename);
  const path = newPath ?? oldPath ?? normalizeDiffPath(headerMatch[2]) ?? headerMatch[2];

  return {
    path,
    oldPath: oldPath ?? undefined,
    newPath: newPath ?? undefined,
    changeType,
    fileRole: classifyFileRole(path),
    addedLines,
    deletedLines,
    isBinary,
    isRename,
    isCopy,
    modeChanged,
    hunks,
    patch: blockLines.join("\n")
  };
}

function parseHunkHeader(line: string): ParsedUnifiedDiffHunk {
  const match = line.match(/^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/);
  const deletedSpan = Number(match?.[1] ?? "1");
  const addedSpan = Number(match?.[2] ?? "1");
  return {
    header: line,
    addedLines: Number.isFinite(addedSpan) ? addedSpan : 0,
    deletedLines: Number.isFinite(deletedSpan) ? deletedSpan : 0
  };
}

function deriveChangeType(
  oldPath: string | null,
  newPath: string | null,
  isRename: boolean
): DiffChangeType {
  if (isRename) return "renamed";
  if (!oldPath && newPath) return "added";
  if (oldPath && !newPath) return "deleted";
  return "modified";
}

function normalizePatchMarker(value: string, fallback: string | null): string | null {
  if (value === "/dev/null") return null;
  return normalizeDiffPath(value.replace(/^[ab]\//, "")) ?? fallback;
}

function normalizeDiffPath(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^[ab]\//, "");
  return normalized.length > 0 ? normalized : null;
}
