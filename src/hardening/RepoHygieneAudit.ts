import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type RepoHygieneFindingLevel = "error" | "warning";

export type RepoHygieneFinding = {
  level: RepoHygieneFindingLevel;
  code: string;
  message: string;
};

export type RepoHygieneAuditResult = {
  valid: boolean;
  findings: RepoHygieneFinding[];
  checked: string[];
};

const requiredFiles = [
  "package.json",
  "package-lock.json",
  ".npmrc",
  ".node-version",
  ".env.example",
  "SECURITY.md",
  "AGENTS.md",
  "README.md",
  "docs/PRODUCT.md",
  "docs/CURRENT_STATUS.md",
  "docs/STAX_DOCTRINE_LOCK.md"
];

const requiredScripts = [
  "audit:repo-hygiene",
  "audit:all-strengthened",
  "validate:hardened",
  "test:ci-safe",
  "stax:attach",
  "stax:collect",
  "stax:gate",
  "stax:status",
  "stax:next"
];

const unsafeEnvPatterns = [
  /OPENAI_API_KEY\s*=\s*sk-[A-Za-z0-9_-]{10,}/,
  /STAX_GITHUB_TOKEN\s*=\s*(ghp_|github_pat_)[A-Za-z0-9_]+/,
  /PASSWORD\s*=\s*\S+/i,
  /SECRET\s*=\s*\S+/i,
  /TOKEN\s*=\s*(ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+/i
];

export function auditRepoHygiene(repoRoot = process.cwd()): RepoHygieneAuditResult {
  const findings: RepoHygieneFinding[] = [];
  const checked: string[] = [];

  for (const file of requiredFiles) {
    checked.push(file);
    const fullPath = join(repoRoot, file);
    if (!existsSync(fullPath)) {
      findings.push({ level: "error", code: "missing-required-file", message: `Missing required file: ${file}` });
    }
  }

  const packageJsonPath = join(repoRoot, "package.json");
  if (existsSync(packageJsonPath)) {
    checked.push("package.json:scripts");
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        engines?: Record<string, string>;
        packageManager?: string;
        scripts?: Record<string, string>;
      };
      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          findings.push({ level: "error", code: "missing-required-script", message: `Missing package script: ${script}` });
        }
      }
      if (!packageJson.engines?.node?.includes(">=22")) {
        findings.push({ level: "error", code: "missing-node-engine", message: "package.json must pin Node engine to >=22." });
      }
      if (!packageJson.engines?.npm?.includes(">=10")) {
        findings.push({ level: "warning", code: "missing-npm-engine", message: "package.json should pin npm engine to >=10." });
      }
      if (!packageJson.packageManager?.startsWith("npm@")) {
        findings.push({ level: "warning", code: "missing-package-manager", message: "packageManager should identify the expected npm version." });
      }
    } catch (error) {
      findings.push({ level: "error", code: "invalid-package-json", message: `package.json is not valid JSON: ${String(error)}` });
    }
  }

  const npmrcPath = join(repoRoot, ".npmrc");
  if (existsSync(npmrcPath)) {
    checked.push(".npmrc:controls");
    const npmrc = readFileSync(npmrcPath, "utf8");
    if (!/^engine-strict=true$/m.test(npmrc)) {
      findings.push({ level: "warning", code: "npm-engine-strict-disabled", message: ".npmrc should enable engine-strict=true." });
    }
    if (!/^save-exact=true$/m.test(npmrc)) {
      findings.push({ level: "warning", code: "npm-save-exact-disabled", message: ".npmrc should enable save-exact=true." });
    }
  }

  const envExamplePath = join(repoRoot, ".env.example");
  if (existsSync(envExamplePath)) {
    checked.push(".env.example:secrets");
    const envExample = readFileSync(envExamplePath, "utf8");
    for (const pattern of unsafeEnvPatterns) {
      if (pattern.test(envExample)) {
        findings.push({ level: "error", code: "unsafe-env-example", message: ".env.example contains a secret-like value." });
      }
    }
  }

  for (const generatedDir of ["node_modules", "dist", "coverage"] as const) {
    const fullPath = join(repoRoot, generatedDir);
    if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
      findings.push({
        level: "warning",
        code: "generated-directory-present",
        message: `${generatedDir}/ exists locally. Do not include it in handoff zips or commits.`
      });
    }
  }

  return {
    valid: findings.every((finding) => finding.level !== "error"),
    findings,
    checked
  };
}

export function formatRepoHygieneAudit(result: RepoHygieneAuditResult): string {
  const lines = [
    `Repo hygiene audit: ${result.valid ? "passed" : "failed"}`,
    `Checked: ${result.checked.length} surfaces`
  ];

  if (result.findings.length === 0) {
    lines.push("Findings: none");
    return lines.join("\n");
  }

  lines.push("Findings:");
  for (const finding of result.findings) {
    lines.push(`- ${finding.level.toUpperCase()} [${finding.code}] ${finding.message}`);
  }
  return lines.join("\n");
}
