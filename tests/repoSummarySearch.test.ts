import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RepoSearch } from "../src/workspace/RepoSearch.js";
import { RepoSummary } from "../src/workspace/RepoSummary.js";

async function tempRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rax-linked-repo-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "tests"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "bad"), { recursive: true });
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "vitest" }, devDependencies: { typescript: "latest" } }), "utf8");
  await fs.writeFile(path.join(root, "README.md"), "# Linked Repo\n\nSummary.", "utf8");
  await fs.writeFile(path.join(root, "src", "main.ts"), "export const visibleNeedle = 'canvas-helper';\n", "utf8");
  await fs.writeFile(path.join(root, "tests", "main.test.ts"), "expect(true).toBe(true);\n", "utf8");
  await fs.writeFile(path.join(root, "node_modules", "bad", "hidden.ts"), "canvas-helper hidden dependency\n", "utf8");
  await fs.writeFile(path.join(root, ".git", "config"), "canvas-helper hidden git\n", "utf8");
  await fs.writeFile(path.join(root, ".env"), "OPENAI_API_KEY=sk-secretsecretsecretsecretsecret\n", "utf8");
  return root;
}

describe("read-only repo summary and search", () => {
  it("summarizes safe repo files without reading ignored folders or .env", async () => {
    const repo = await tempRepo();
    const before = await snapshot(repo);
    const summary = await new RepoSummary(repo).summarize();
    const after = await snapshot(repo);

    expect(summary.markdown).toContain("## Repo Summary");
    expect(summary.markdown).toContain("## Detected Stack");
    expect(summary.markdown).toContain("src/main.ts");
    expect(summary.markdown).not.toContain("sk-secret");
    expect(summary.markdown).not.toContain("hidden dependency");
    expect(summary.markdown).not.toContain(".git/config");
    expect(after).toEqual(before);
  });

  it("searches text files and ignores node_modules, .git, and .env", async () => {
    const repo = await tempRepo();
    const search = new RepoSearch(repo);

    const found = await search.search("canvas-helper");
    const hidden = await search.search("sk-secret");

    expect(found.map((item) => item.path)).toEqual(["src/main.ts"]);
    expect(found[0]?.snippet).toContain("canvas-helper");
    expect(hidden).toEqual([]);
  });

  it("handles missing package.json in repo summary", async () => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), "rax-linked-no-package-"));
    await fs.writeFile(path.join(repo, "README.md"), "# No Package\n", "utf8");

    const summary = await new RepoSummary(repo).summarize();

    expect(summary.markdown).toContain("No package.json scripts detected");
    expect(summary.markdown).not.toContain("undefined");
  });
});

async function snapshot(root: string): Promise<Array<{ path: string; mtimeMs: number }>> {
  const entries: Array<{ path: string; mtimeMs: number }> = [];
  async function visit(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const stat = await fs.lstat(full);
      entries.push({ path: path.relative(root, full), mtimeMs: stat.mtimeMs });
      if (entry.isDirectory()) await visit(full);
    }
  }
  await visit(root);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
