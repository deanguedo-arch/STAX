import fs from "node:fs/promises";
import path from "node:path";
import {
  DiffAuditFixtureFileSchema,
  DiffAuditInputSchema,
  type ClassifiedDiffFile,
  type DiffAuditFinding,
  type DiffAuditFindingId,
  type DiffAuditFixtureCase,
  type DiffAuditInput,
  type DiffAuditResult,
  type DiffFileRole,
  type DiffRiskLevel,
  type DiffScopeStatus,
  type ParsedDiffAuditInput
} from "./DiffAuditSchemas.js";

const SOURCE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
  ".svelte"
]);

const VISUAL_STYLE_EXTENSIONS = new Set([".css", ".less", ".sass", ".scss"]);
const LOCKFILE_NAMES = new Set([
  "cargo.lock",
  "composer.lock",
  "gemfile.lock",
  "go.sum",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock"
]);

const CONFIG_NAMES = new Set([
  ".babelrc",
  ".eslintrc",
  ".prettierrc",
  "eslint.config.js",
  "eslint.config.mjs",
  "package.json",
  "playwright.config.ts",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts"
]);

export function classifyFileRole(filePath: string): DiffFileRole {
  const normalized = normalizePath(filePath);
  const basename = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized);

  if (LOCKFILE_NAMES.has(basename)) return "lockfile";
  if (isFixturePath(normalized)) return "fixture";
  if (isGeneratedPath(normalized)) return "generated";
  if (isMigrationPath(normalized)) return "migration";
  if (isScriptPath(normalized)) return "script";
  if (VISUAL_STYLE_EXTENSIONS.has(extension)) return "visual_style";
  if (isTestPath(normalized)) return "test";
  if (isDocsPath(normalized)) return "docs";
  if (isConfigPath(normalized, basename)) return "config";
  if (SOURCE_EXTENSIONS.has(extension)) return "source";
  return "unknown";
}

export function auditDiffEvidence(input: DiffAuditInput): DiffAuditResult {
  const parsed = DiffAuditInputSchema.parse(input);
  const classifiedFiles = parsed.changedFiles.map((file) => classifyChangedFile(parsed, file));
  const findings = collectFindings(parsed, classifiedFiles);
  const verdict = findings.some((finding) => finding.severity === "critical")
    ? "reject"
    : findings.some((finding) => finding.severity === "major")
      ? "provisional"
      : "accept";
  const result: DiffAuditResult = {
    verdict,
    classifiedFiles,
    findings,
    summary: summarizeFiles(classifiedFiles),
    nextAction: renderNextAction(verdict, findings)
  };
  return result;
}

export async function loadDiffAuditFixtureCases(rootDir = process.cwd()): Promise<DiffAuditFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "diff_audit");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("diff_audit_") && file.endsWith(".json"))
    .sort();
  const cases: DiffAuditFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...DiffAuditFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

function collectFindings(parsed: ParsedDiffAuditInput, files: ClassifiedDiffFile[]): DiffAuditFinding[] {
  const findings: DiffAuditFinding[] = [];
  const roles = new Set(files.map((file) => file.fileRole));
  const hardClaimTypes = new Set(parsed.claims.filter((claim) => claim.hardClaim).map((claim) => claim.claimType));
  const hasHardImplementationClaim = hardClaimTypes.has("implementation");
  const hasHardBehaviorClaim = hardClaimTypes.has("behavior");
  const hasHardVisualClaim = hardClaimTypes.has("visual");
  const hasImplementationOrBehaviorClaim = hasHardImplementationClaim || hasHardBehaviorClaim;

  const allDocs = allFilesHaveRoles(roles, ["docs"]);
  const allTests = allFilesHaveRoles(roles, ["test"]);
  const onlyGenerated = allFilesHaveRoles(roles, ["generated"]);
  const onlyLockfile = allFilesHaveRoles(roles, ["lockfile"]);
  const hasSource = roles.has("source");
  const hasTest = roles.has("test");
  const hasFixture = roles.has("fixture");
  const hasVisualStyle = roles.has("visual_style");
  const hasForbiddenConfig = files.some((file) =>
    file.scopeStatus === "forbidden" ||
    (file.fileRole === "config" && file.forbidden && !parsed.evidence.humanApprovalForForbidden)
  );
  const outOfScopeSourcePaths = files
    .filter((file) => file.fileRole === "source" && file.scopeStatus === "out_of_scope")
    .map((file) => file.path);

  if (hasImplementationOrBehaviorClaim && allDocs) {
    findings.push(finding(
      "docs_only_implementation_claim",
      "critical",
      "Docs-only diff cannot prove an implementation or behavior claim.",
      files.map((file) => file.path),
      true
    ));
  }

  if (hasHardBehaviorClaim && allTests) {
    findings.push(finding(
      "tests_only_behavior_claim",
      "critical",
      "Tests-only diff cannot prove runtime behavior changed.",
      files.map((file) => file.path),
      true
    ));
  }

  if (hasImplementationOrBehaviorClaim && hasSource && !hasTest && !parsed.evidence.behaviorTestEvidence) {
    findings.push(finding(
      "source_only_no_test_claim",
      "major",
      "Source changed without test or behavior evidence; implementation remains provisional.",
      files.filter((file) => file.fileRole === "source").map((file) => file.path),
      false
    ));
  }

  if (hasImplementationOrBehaviorClaim && hasFixture && !hasSource) {
    findings.push(finding(
      "fixture_golden_laundering",
      "critical",
      "Fixture/golden changes cannot be treated as the behavior fix by themselves.",
      files.filter((file) => file.fileRole === "fixture").map((file) => file.path),
      true
    ));
  }

  if (hasForbiddenConfig) {
    findings.push(finding(
      "forbidden_config_change",
      "critical",
      "Forbidden or unapproved config change requires human review before acceptance.",
      files.filter((file) => file.fileRole === "config" || file.scopeStatus === "forbidden").map((file) => file.path),
      true
    ));
  }

  if (hasImplementationOrBehaviorClaim && onlyGenerated) {
    findings.push(finding(
      "generated_file_only_claim",
      "critical",
      "Generated-file-only diff does not prove source behavior changed.",
      files.map((file) => file.path),
      true
    ));
  }

  if (outOfScopeSourcePaths.length > 0) {
    findings.push(finding(
      "out_of_scope_source_edit",
      "critical",
      "Source diff touches paths outside the stated task scope.",
      outOfScopeSourcePaths,
      true
    ));
  }

  if (hasImplementationOrBehaviorClaim && onlyLockfile) {
    findings.push(finding(
      "lockfile_only_overclaim",
      "critical",
      "Lockfile-only diff cannot prove implementation or behavior changed.",
      files.map((file) => file.path),
      true
    ));
  }

  if ((hasHardVisualClaim || hasVisualStyle) && !parsed.evidence.visualProofProvided) {
    findings.push(finding(
      "visual_source_without_visual_proof",
      "major",
      "Visual/style changes need rendered screenshot or visual checklist proof.",
      files.filter((file) => file.fileRole === "visual_style" || file.fileRole === "source").map((file) => file.path),
      false
    ));
  }

  return dedupeFindings(findings);
}

function classifyChangedFile(
  input: ParsedDiffAuditInput,
  file: ParsedDiffAuditInput["changedFiles"][number]
): ClassifiedDiffFile {
  const normalizedPath = normalizePath(file.path);
  const role = file.fileRole ?? classifyFileRole(normalizedPath);
  const forbiddenByPath = input.evidence.forbiddenPaths.some((forbiddenPath) =>
    normalizedPath === normalizePath(forbiddenPath) || normalizedPath.startsWith(`${normalizePath(forbiddenPath).replace(/\/$/, "")}/`)
  );
  const forbidden = Boolean(file.forbidden || forbiddenByPath);
  const scopeStatus = classifyScopeStatus(input, normalizedPath, forbidden, file.inScope);
  return {
    ...file,
    path: normalizedPath,
    fileRole: role,
    riskLevel: file.riskLevel ?? inferRiskLevel(role, forbidden, scopeStatus),
    scopeStatus,
    forbidden,
    reason: file.reason ?? inferReason(role, scopeStatus)
  };
}

function classifyScopeStatus(
  input: ParsedDiffAuditInput,
  filePath: string,
  forbidden: boolean,
  inScope: boolean | undefined
): DiffScopeStatus {
  if (forbidden) return "forbidden";
  if (inScope === false) return "out_of_scope";
  if (inScope === true) return "in_scope";
  if (!input.evidence.taskScopePaths.length) return "maybe_in_scope";
  return input.evidence.taskScopePaths.some((scopePath) => filePath.startsWith(normalizePath(scopePath)))
    ? "in_scope"
    : "out_of_scope";
}

function inferRiskLevel(role: DiffFileRole, forbidden: boolean, scopeStatus: DiffScopeStatus): DiffRiskLevel {
  if (forbidden || scopeStatus === "forbidden") return "critical";
  if (scopeStatus === "out_of_scope") return "high";
  if (role === "config" || role === "migration") return "high";
  if (role === "source" || role === "script" || role === "fixture" || role === "lockfile") return "medium";
  return "low";
}

function inferReason(role: DiffFileRole, scopeStatus: DiffScopeStatus): string {
  if (scopeStatus === "forbidden") return "Path is forbidden for this task.";
  if (scopeStatus === "out_of_scope") return "Path is outside the stated task scope.";
  return `Classified as ${role}.`;
}

function summarizeFiles(files: ClassifiedDiffFile[]): DiffAuditResult["summary"] {
  return {
    sourceFiles: countRole(files, "source"),
    testFiles: countRole(files, "test"),
    docsFiles: countRole(files, "docs"),
    fixtureFiles: countRole(files, "fixture"),
    configFiles: countRole(files, "config"),
    generatedFiles: countRole(files, "generated"),
    lockfileFiles: countRole(files, "lockfile"),
    scriptFiles: countRole(files, "script"),
    migrationFiles: countRole(files, "migration"),
    visualStyleFiles: countRole(files, "visual_style"),
    unknownFiles: countRole(files, "unknown")
  };
}

function countRole(files: ClassifiedDiffFile[], role: DiffFileRole): number {
  return files.filter((file) => file.fileRole === role).length;
}

function allFilesHaveRoles(roles: Set<DiffFileRole>, allowed: DiffFileRole[]): boolean {
  return roles.size > 0 && [...roles].every((role) => allowed.includes(role));
}

function finding(
  id: DiffAuditFindingId,
  severity: DiffAuditFinding["severity"],
  message: string,
  paths: string[],
  criticalIfAccepted: boolean
): DiffAuditFinding {
  return { id, severity, message, paths, criticalIfAccepted };
}

function dedupeFindings(findings: DiffAuditFinding[]): DiffAuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}

function renderNextAction(verdict: DiffAuditResult["verdict"], findings: DiffAuditFinding[]): string {
  if (verdict === "accept") return "Accept the diff audit only within the supplied scope and preserve command proof with the run.";
  const critical = findings.find((finding) => finding.severity === "critical");
  if (critical) return `Block acceptance until this proof gap is resolved: ${critical.message}`;
  return "Keep the diff provisional and ask Codex for the missing behavior, test, or visual proof.";
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function isFixturePath(filePath: string): boolean {
  return /(^|\/)(__fixtures__|fixtures?|goldens?|snapshots?)(\/|$)/.test(filePath) || /\.snap$/.test(filePath);
}

function isGeneratedPath(filePath: string): boolean {
  return /(^|\/)(dist|build|coverage|generated|out)(\/|$)/.test(filePath) || /\.generated\./.test(filePath) || /\.gen\./.test(filePath);
}

function isMigrationPath(filePath: string): boolean {
  return /(^|\/)(migrations?|db\/migrate)(\/|$)/.test(filePath);
}

function isScriptPath(filePath: string): boolean {
  return /(^|\/)(scripts?|tools?)(\/|$)/.test(filePath) || /\.(bat|cmd|ps1|sh)$/.test(filePath);
}

function isTestPath(filePath: string): boolean {
  return /(^|\/)(__tests__|tests?|spec)(\/|$)/.test(filePath) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath);
}

function isDocsPath(filePath: string): boolean {
  return /(^|\/)(docs?|documentation)(\/|$)/.test(filePath) || /(^|\/)readme(\.[a-z]+)?$/.test(filePath) || /\.(md|mdx|rst)$/.test(filePath);
}

function isConfigPath(filePath: string, basename: string): boolean {
  return CONFIG_NAMES.has(basename) || /(^|\/)(config|\.github\/workflows)(\/|$)/.test(filePath) || /\.config\.[cm]?[jt]s$/.test(filePath);
}
