import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "staxcore");
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

function files(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    })
    .filter((path) => path.endsWith(".ts"));
}

describe("import boundaries", () => {
  it("prevents non-adjacent staxcore layer imports", () => {
    const violations: string[] = [];

    for (const rule of forbidden) {
      const dir = join(root, rule.layer);
      for (const file of files(dir)) {
        if (rule.pattern.test(readFileSync(file, "utf8"))) {
          violations.push(file);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
