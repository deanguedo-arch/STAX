import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src", "staxcore");
const allowedDirectTruthFiles = new Set([
  join("kernel", "validateCandidate.ts"),
  join("types", "core.ts"),
  join("types", "signal.ts"),
  join("types", "validation.ts")
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("staxcore main path architecture guard", () => {
  it("does not route processObservation through legacy event horizon validation", () => {
    const source = readFileSync(
      join(sourceRoot, "core", "api", "processObservation.ts"),
      "utf8"
    );

    expect(source).toContain("evaluateCandidate");
    expect(source).not.toContain("validateEventHorizon");
  });

  it("keeps direct validated-event construction inside the kernel authority", () => {
    const offenders = sourceFiles(sourceRoot)
      .map((path) => ({
        path,
        relativePath: relative(sourceRoot, path),
        source: readFileSync(path, "utf8")
      }))
      .filter(({ relativePath }) => !allowedDirectTruthFiles.has(relativePath))
      .filter(({ source }) =>
        [
          /const\s+event:\s*ValidatedEvent/,
          /const\s+validation:\s*ValidatedEvent/,
          /state:\s*"VALIDATED"/
        ].some((pattern) => pattern.test(source))
      )
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });
});
