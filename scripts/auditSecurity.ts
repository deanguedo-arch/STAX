import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const scanPaths = [
  join(process.cwd(), "src", "staxcore"),
  join(process.cwd(), "docs", "STAX_DOCTRINE_LOCK.md"),
  join(process.cwd(), "docs", "MIGRATION_MAP.md")
];

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{10,}/,
  /api[_-]?key\s*[:=]\s*[A-Za-z0-9_\-]+/i,
  /password\s*[:=]\s*.+/i,
  /bearer\s+[A-Za-z0-9._-]+/i
];

function collectFiles(path: string): string[] {
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return [path];
  }
  return readdirSync(path).flatMap((name) => {
    const next = join(path, name);
    const nextStats = statSync(next);
    return nextStats.isDirectory() ? collectFiles(next) : [next];
  });
}

const files = scanPaths.flatMap((path) => collectFiles(path));
const hits: string[] = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    hits.push(file);
  }
}

if (hits.length > 0) {
  console.error("Security audit failed. Secret-like content found:");
  console.error(hits.join("\n"));
  process.exit(1);
}

console.log("Security audit passed.");
