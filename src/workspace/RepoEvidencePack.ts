import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RepoEvidencePackSchema, type RepoEvidencePack, type RepoRedaction, type RepoSkippedPath } from "./RepoEvidenceSchemas.js";
import { resolveEvidenceRepoRoot } from "./RepoPathGuards.js";
import { RepoSafeFileReader, type SafeRepoText } from "./RepoSafeFileReader.js";

const execFileAsync = promisify(execFile);

export type RepoEvidencePackInput = {
  repoPath: string;
  workspace?: string;
  workspaceResolution: "named_workspace" | "active_workspace" | "current_repo";
};

export class RepoEvidencePackBuilder {
  async build(input: RepoEvidencePackInput): Promise<RepoEvidencePack> {
    const repoRoot = await resolveEvidenceRepoRoot(input.repoPath);
    const reader = new RepoSafeFileReader(repoRoot);
    const [packageJson, readme, tsconfig, rootConfigs, operationalReads, gitStatus, sourceTree, scriptsTree, scriptsTestsTree, testsTree, testTree, e2eTree, docsTree] = await Promise.all([
      reader.readText("package.json"),
      reader.readText("README.md"),
      reader.readText("tsconfig.json"),
      reader.readRootConfigs(),
      this.readOperationalFiles(reader),
      this.readGitStatus(repoRoot),
      reader.listTree("src", 3),
      reader.listTree("scripts", 2),
      reader.listTree(path.join("scripts", "tests"), 3),
      reader.listTree("tests", 3),
      reader.listTree("test", 3),
      reader.listTree("e2e", 4),
      reader.listTree("docs", 2)
    ]);

    const safeReads = uniqueReads([packageJson, readme, tsconfig, ...rootConfigs, ...operationalReads]);
    const inspectedFiles = safeReads.filter((item) => item.text !== undefined).map((item) => item.path);
    const configFiles = inspectedFiles.filter((file) => isConfigFile(file));
    const sourceFiles = sourceTree.files;
    const testFiles = [...testsTree.files, ...testTree.files, ...scriptsTestsTree.files, ...e2eTree.files].filter(isTestLikeFile);
    const docsFiles = docsTree.files;
    const operationalFiles = operationalReads.filter((item) => item.text !== undefined).map((item) => item.path);
    const skippedPaths = [
      ...safeReads.filter((item) => item.skipped).map((item) => ({ path: item.path, reason: item.skipped! })),
      ...sourceTree.skipped,
      ...scriptsTree.skipped,
      ...scriptsTestsTree.skipped,
      ...testsTree.skipped,
      ...testTree.skipped,
      ...e2eTree.skipped,
      ...docsTree.skipped
    ];
    const redactions = safeReads.flatMap((item) => item.redaction ? [item.redaction] : []);
    const pkg = parsePackage(packageJson?.text);
    const scripts = extractScripts(pkg);
    const missingExpectedFiles = await this.missingExpectedFiles(repoRoot, ["package.json", "README.md", "src"]);
    const riskFlags = this.riskFlags({
      packageJson,
      readme,
      scripts,
      testFiles,
      skippedPaths,
      redactions,
      importantFiles: [...sourceFiles, ...scriptsTree.files, ...testFiles, ...docsFiles],
      operationalReads,
      gitStatus
    });
    const snippets = safeReads
      .filter((item) => item.text)
      .slice(0, 12)
      .map((item) => ({ path: item.path, excerpt: compactExcerpt(item.text!) }));
    const importantFiles = [
      ...inspectedFiles,
      ...sourceFiles.slice(0, 50),
      ...scriptsTree.files.slice(0, 50),
      ...testFiles.slice(0, 50),
      ...docsFiles.slice(0, 30)
    ];

    const draft = {
      repoPath: repoRoot,
      workspace: input.workspace,
      workspaceResolution: input.workspaceResolution,
      createdAt: new Date().toISOString(),
      gitStatus,
      inspectedFiles,
      importantFiles: [...new Set(importantFiles)],
      configFiles,
      sourceFiles,
      testFiles,
      docsFiles,
      operationalFiles,
      scripts,
      missingExpectedFiles,
      riskFlags,
      skippedPaths: dedupeSkipped(skippedPaths),
      redactions: dedupeRedactions(redactions),
      snippets,
      markdown: ""
    };
    const pack = {
      ...draft,
      markdown: formatRepoEvidencePack(draft)
    };
    return RepoEvidencePackSchema.parse(pack);
  }

  private async missingExpectedFiles(repoRoot: string, relativePaths: string[]): Promise<string[]> {
    const missing: string[] = [];
    for (const relative of relativePaths) {
      try {
        await fs.stat(path.join(repoRoot, relative));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") missing.push(relative);
        else throw error;
      }
    }
    return missing;
  }

  private async readOperationalFiles(reader: RepoSafeFileReader): Promise<SafeRepoText[]> {
    const paths = [
      path.join("docs", "ops", "ACTIVE_HANDOFF.md"),
      path.join("docs", "ops", "FAST_PATHS.md"),
      path.join("docs", "ops", "session-checklist.md"),
      path.join("docs", "ops", "codex-mac-workflow.md")
    ];
    return (await Promise.all(paths.map((relative) => reader.readText(relative)))).filter(Boolean) as SafeRepoText[];
  }

  private async readGitStatus(repoRoot: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync("git", ["-C", repoRoot, "status", "--short", "--branch"], {
        timeout: 3000,
        maxBuffer: 64 * 1024
      });
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private riskFlags(input: {
    packageJson?: SafeRepoText;
    readme?: SafeRepoText;
    scripts: Array<{ name: string; command: string }>;
    testFiles: string[];
    skippedPaths: RepoSkippedPath[];
    redactions: RepoRedaction[];
    importantFiles: string[];
    operationalReads: SafeRepoText[];
    gitStatus?: string;
  }): string[] {
    const risks: string[] = [];
    if (!input.packageJson?.text) risks.push("package_json_missing_or_unreadable");
    if (!input.readme?.text) risks.push("readme_missing_or_unreadable");
    if (!input.scripts.some((script) => /test/i.test(script.name))) risks.push("no_test_script_detected");
    if (input.testFiles.length === 0) risks.push("no_test_tree_detected");
    if (!input.gitStatus) risks.push("git_status_unavailable");
    else if (/\n\s*[MADRCU?]{1,2}\s+/m.test(input.gitStatus)) risks.push("git_worktree_has_changes");
    if (input.importantFiles.some((file) => /(^|[/\\]).* 2(\.|$)/.test(file))) risks.push("duplicate_copy_file_names_detected");
    const activeHandoff = input.operationalReads.find((item) => item.path === path.join("docs", "ops", "ACTIVE_HANDOFF.md"))?.text;
    if (activeHandoff && /\b(fails?|failing|red test|still red)\b/i.test(activeHandoff)) risks.push("active_handoff_mentions_red_or_failing_test");
    if (activeHandoff && /\bmanual browser\b/i.test(activeHandoff) && /\bnot run|did not run|needs validation|still needs validation\b/i.test(activeHandoff)) {
      risks.push("active_handoff_has_unvalidated_manual_check");
    }
    if (input.redactions.length) risks.push("secret_like_values_redacted");
    if (input.skippedPaths.some((item) => /secret|ignored|outside|symlink/i.test(item.reason))) risks.push("sensitive_or_unsafe_paths_skipped");
    return risks;
  }
}

export function formatRepoEvidencePack(pack: Omit<RepoEvidencePack, "markdown">): string {
  return [
    "## Workspace / Repo",
    `- Workspace: ${pack.workspace ?? "current_repo"}`,
    `- WorkspaceResolution: ${pack.workspaceResolution}`,
    `- RepoPath: ${pack.repoPath}`,
    ...(pack.gitStatus ? ["", "## Git Status", "```txt", pack.gitStatus, "```"] : []),
    "",
    "## Evidence Checked",
    ...listOrNone(pack.inspectedFiles.map((file) => `- ${file}`)),
    "",
    "## Files Inspected",
    ...listOrNone(pack.importantFiles.slice(0, 160).map((file) => `- ${file}`)),
    "",
    "## Scripts / Test Commands Found",
    ...listOrNone(pack.scripts.map((script) => `- ${script.name}: ${script.command}`)),
    "",
    "## Operational Files Checked",
    ...listOrNone(pack.operationalFiles.map((file) => `- ${file}`)),
    "",
    "## Claims Verified",
    ...([
      pack.inspectedFiles.length ? "- Repo evidence pack inspected safe root files." : undefined,
      pack.sourceFiles.length ? "- Source tree was enumerated read-only." : undefined,
      pack.testFiles.length ? "- Test tree was enumerated read-only." : undefined,
      pack.operationalFiles.length ? "- Operational handoff/workflow docs were inspected read-only." : undefined,
      pack.gitStatus ? "- Git status was checked read-only." : undefined,
      pack.scripts.length ? "- package.json scripts were extracted read-only." : undefined
    ].filter(Boolean) as string[]),
    ...(pack.inspectedFiles.length || pack.sourceFiles.length || pack.testFiles.length || pack.scripts.length ? [] : ["- No claims verified from repo evidence."]),
    "",
    "## Claims Not Verified",
    "- Tests were not run in the linked repo.",
    "- Source behavior was not executed.",
    "- No source files were modified.",
    "",
    "## Risks",
    ...listOrNone(pack.riskFlags.map((risk) => `- ${risk}`)),
    "",
    "## Missing Evidence",
    ...listOrNone(pack.missingExpectedFiles.map((file) => `- ${file}`)),
    ...(pack.skippedPaths.length ? ["", "## Skipped / Redacted", ...pack.skippedPaths.slice(0, 40).map((item) => `- ${item.path}: ${item.reason}`)] : []),
    ...(pack.redactions.length ? ["", "## Redaction Summary", ...pack.redactions.map((item) => `- ${item.path}: ${item.count} ${item.reason}`)] : []),
    "",
    "## Next Allowed Action",
    "- Use this evidence for audit/planning only. Do not mutate the linked repo without an explicit future approval path."
  ].join("\n");
}

function parsePackage(text?: string): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function extractScripts(pkg?: Record<string, unknown>): Array<{ name: string; command: string }> {
  if (!pkg?.scripts || typeof pkg.scripts !== "object") return [];
  return Object.entries(pkg.scripts as Record<string, unknown>).map(([name, command]) => ({
    name,
    command: String(command)
  }));
}

function isConfigFile(file: string): boolean {
  return /(^package\.json$|^tsconfig\.json$|config\.|\.eslintrc)/i.test(file);
}

function isTestLikeFile(file: string): boolean {
  return /(^|[/\\])(tests?|scripts[/\\]tests|e2e)([/\\].*)?\.(test|spec)\.[cm]?[jt]sx?$|(^|[/\\])(tests?|scripts[/\\]tests|e2e)[/\\]/i.test(file);
}

function uniqueReads(reads: Array<SafeRepoText | undefined>): SafeRepoText[] {
  const seen = new Set<string>();
  const result: SafeRepoText[] = [];
  for (const read of reads) {
    if (!read || seen.has(read.path)) continue;
    seen.add(read.path);
    result.push(read);
  }
  return result;
}

function dedupeSkipped(items: RepoSkippedPath[]): RepoSkippedPath[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.path}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRedactions(items: RepoRedaction[]): RepoRedaction[] {
  const byPath = new Map<string, RepoRedaction>();
  for (const item of items) {
    const existing = byPath.get(item.path);
    byPath.set(item.path, existing ? { ...item, count: existing.count + item.count } : item);
  }
  return Array.from(byPath.values());
}

function compactExcerpt(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

function listOrNone(items: string[]): string[] {
  return items.length ? items : ["- None"];
}
