import { basename, extname, join, relative } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

const scanPaths = [
  join(process.cwd(), "src"),
  join(process.cwd(), "scripts"),
  join(process.cwd(), "tests"),
  join(process.cwd(), "docs"),
  join(process.cwd(), "package.json"),
  join(process.cwd(), "package-lock.json")
];

const skippedDirectoryNames = new Set([
  ".git",
  ".stax",
  "coverage",
  "dist",
  "node_modules",
  "runs"
]);

const skippedRelativePrefixes = ["docs/releases/"];

const textExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

const secretPatterns = [
  { label: "OpenAI-style secret", pattern: /sk-[A-Za-z0-9_-]{10,}/ },
  {
    label: "API key assignment",
    pattern: /\bapi[_-]?key\s*[:=]\s*(?:sk-[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{16,})\b/i
  },
  { label: "password assignment", pattern: /\bpassword\s*[:=]\s*.+/i },
  { label: "bearer token", pattern: /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i }
];

const allowedFixtureLines = [
  {
    filePattern: /^(scripts\/auditSecurity\.ts|tests\/)/,
    linePattern:
      /OPENAI_API_KEY=sk-(fixture-secret-value|secretsecretsecretsecretsecret|abcdefghijklmnopqrstuvwxyz123456)/,
    reason: "intentional redaction fixture"
  },
  {
    filePattern: /^(scripts\/auditSecurity\.ts|tests\/)/,
    linePattern:
      /sk-(fixture-secret-value|secretsecretsecretsecretsecret|abcdefghijklmnopqrstuvwxyz123456|test-secret-value-that-must-not-print)/,
    reason: "intentional redaction fixture"
  },
  {
    filePattern: /^(scripts\/auditSecurity\.ts|tests\/)/,
    linePattern: /password: hunter2/,
    reason: "intentional security fixture"
  },
  {
    filePattern: /^(scripts\/auditSecurity\.ts|tests\/)/,
    linePattern: /Bearer abcdefghijklmnop(?:qrstuvwxyz)?/,
    reason: "intentional bearer-token fixture"
  },
  {
    filePattern: /^(scripts\/auditSecurity\.ts|tests\/)/,
    linePattern: /API_KEY=supersecretvalue/,
    reason: "intentional blocked-secret fixture"
  }
];

type Finding = {
  file: string;
  line: number;
  label: string;
  allowedReason?: string;
};

function repoRelative(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function shouldSkipPath(path: string): boolean {
  const relativePath = repoRelative(path);
  return skippedRelativePrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function isTextFile(path: string): boolean {
  const name = basename(path);
  return name.startsWith(".env") || name === ".npmrc" || textExtensions.has(extname(path));
}

function collectFiles(path: string): string[] {
  if (!existsSync(path) || shouldSkipPath(path)) {
    return [];
  }

  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return isTextFile(path) ? [path] : [];
  }

  return readdirSync(path).flatMap((name) => {
    const next = join(path, name);
    const nextStats = statSync(next);
    if (nextStats.isDirectory() && skippedDirectoryNames.has(name)) {
      return [];
    }
    return collectFiles(next);
  });
}

const files = scanPaths.flatMap((path) => collectFiles(path));
const findings: Finding[] = [];
const allowedFindings: Finding[] = [];

function allowedReason(file: string, lineText: string): string | undefined {
  const allowed = allowedFixtureLines.find(
    (fixture) => fixture.filePattern.test(file) && fixture.linePattern.test(lineText)
  );
  return allowed?.reason;
}

for (const file of files) {
  const relativeFile = repoRelative(file);
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);

  for (const [index, lineText] of lines.entries()) {
    for (const { label, pattern } of secretPatterns) {
      if (!pattern.test(lineText)) {
        continue;
      }

      const finding: Finding = {
        file: relativeFile,
        line: index + 1,
        label,
        allowedReason: allowedReason(relativeFile, lineText)
      };

      if (finding.allowedReason) {
        allowedFindings.push(finding);
      } else {
        findings.push(finding);
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Security audit failed. Secret-like content found:");
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.label}`);
  }
  process.exit(1);
}

console.log("Security audit passed.");
console.log(`Scanned ${files.length} files across src/, scripts/, tests/, docs/, and package files.`);
if (allowedFindings.length > 0) {
  console.log(`Allowed fixture findings: ${allowedFindings.length}`);
}
