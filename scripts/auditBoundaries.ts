import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const coreRoot = join(process.cwd(), "src", "staxcore");
const required = [
  "ingest",
  "structure",
  "validate",
  "signal",
  "confidence",
  "frame",
  "context",
  "exchange",
  "shared",
  "types"
];

if (!existsSync(coreRoot)) {
  console.error("Boundary audit failed. Missing src/staxcore.");
  process.exit(1);
}

const missing = required.filter((dir) => !existsSync(join(coreRoot, dir)));
if (missing.length > 0) {
  console.error(`Boundary audit failed. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

function files(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    })
    .filter((path) => path.endsWith(".ts"));
}

const forbidden = [
  {
    layer: "ingest",
    pattern:
      /from ['"]\.\.\/(validate|signal|confidence|frame|context|exchange|core)\//
  },
  {
    layer: "structure",
    pattern: /from ['"]\.\.\/(signal|confidence|frame|context|exchange|core)\//
  },
  { layer: "validate", pattern: /from ['"]\.\.\/(frame|context|exchange|core)\// },
  { layer: "signal", pattern: /from ['"]\.\.\/(frame|context|exchange|core)\// },
  { layer: "confidence", pattern: /from ['"]\.\.\/(exchange|core)\// }
];

const violations: string[] = [];
for (const rule of forbidden) {
  const dir = join(coreRoot, rule.layer);
  for (const file of files(dir)) {
    if (rule.pattern.test(readFileSync(file, "utf8"))) {
      violations.push(file);
    }
  }
}

if (violations.length > 0) {
  console.error("Boundary audit failed. Forbidden cross-layer imports found:");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Boundary audit passed.");
