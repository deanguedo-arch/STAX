import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kernelRoot = join(process.cwd(), "src", "staxcore", "kernel");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("staxcore kernel import boundaries", () => {
  it("does not import meta, agent, provider, sidecar, or domain layers", () => {
    expect(existsSync(kernelRoot)).toBe(true);

    const forbiddenImports = [
      /from\s+["'][^"']*agents\//,
      /from\s+["'][^"']*chat\//,
      /from\s+["'][^"']*providers\//,
      /from\s+["'][^"']*modes\//,
      /from\s+["'][^"']*rax\//,
      /from\s+["'][^"']*sidecar\//,
      /from\s+["'][^"']*domain/
    ];

    const violations = files(kernelRoot)
      .filter((path) => path.endsWith(".ts"))
      .flatMap((path) => {
        const text = readFileSync(path, "utf8");
        return forbiddenImports.some((pattern) => pattern.test(text)) ? [path] : [];
      });

    expect(violations).toEqual([]);
  });
});
