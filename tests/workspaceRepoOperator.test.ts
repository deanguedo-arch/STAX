import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatIntentClassifier } from "../src/operator/ChatIntentClassifier.js";
import { RepoEvidencePackBuilder } from "../src/workspace/RepoEvidencePack.js";
import { RepoSafeFileReader } from "../src/workspace/RepoSafeFileReader.js";

async function tempRepo(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-workspace-repo-"));
}

async function createFixtureRepo(): Promise<string> {
  const repo = await tempRepo();
  await fs.mkdir(path.join(repo, "src"), { recursive: true });
  await fs.mkdir(path.join(repo, "tests"), { recursive: true });
  await fs.mkdir(path.join(repo, "node_modules", "pkg"), { recursive: true });
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await fs.mkdir(path.join(repo, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(repo, "package.json"),
    JSON.stringify({ scripts: { test: "vitest run", typecheck: "tsc --noEmit" } }, null, 2),
    "utf8"
  );
  await fs.writeFile(path.join(repo, "README.md"), "# Fixture Repo\n\nProof fixture.", "utf8");
  await fs.writeFile(path.join(repo, "src", "index.ts"), "export const ok = true;\n", "utf8");
  await fs.writeFile(path.join(repo, "tests", "index.test.ts"), "expect(true).toBe(true);\n", "utf8");
  await fs.writeFile(path.join(repo, "node_modules", "pkg", "index.js"), "module.exports = {}\n", "utf8");
  await fs.writeFile(path.join(repo, ".git", "config"), "secret\n", "utf8");
  await fs.writeFile(path.join(repo, "dist", "bundle.js"), "compiled\n", "utf8");
  await fs.writeFile(path.join(repo, "src", ".DS_Store"), "metadata\n", "utf8");
  await fs.writeFile(path.join(repo, "src", "image.png"), "not really an image\n", "utf8");
  await fs.writeFile(path.join(repo, ".env"), "OPENAI_API_KEY=sk-fixture-secret-value\n", "utf8");
  await fs.writeFile(path.join(repo, "private.key"), "secret key\n", "utf8");
  await fs.writeFile(path.join(repo, "config.json"), JSON.stringify({ token: "super-secret-token" }), "utf8");
  return repo;
}

describe("workspace repo operator evidence pack", () => {
  it("builds read-only repo evidence with scripts, source files, and test files", async () => {
    const repo = await createFixtureRepo();

    const pack = await new RepoEvidencePackBuilder().build({
      repoPath: repo,
      workspace: "fixture",
      workspaceResolution: "named_workspace"
    });

    expect(pack.workspace).toBe("fixture");
    expect(pack.repoPath).toBe(repo);
    expect(pack.inspectedFiles).toContain("package.json");
    expect(pack.inspectedFiles).toContain("README.md");
    expect(pack.sourceFiles).toContain(path.join("src", "index.ts"));
    expect(pack.testFiles).toContain(path.join("tests", "index.test.ts"));
    expect(pack.scripts).toContainEqual({ name: "test", command: "vitest run" });
    expect(pack.markdown).toContain("## Scripts / Test Commands Found");
    expect(pack.markdown).toContain("Tests were not run in the linked repo.");
  });

  it("skips ignored, secret-like, binary, and symlink paths", async () => {
    const repo = await createFixtureRepo();
    const outside = await tempRepo();
    await fs.writeFile(path.join(outside, "outside.txt"), "outside secret\n", "utf8");
    await fs.symlink(path.join(outside, "outside.txt"), path.join(repo, "src", "outside-link.txt"));

    const pack = await new RepoEvidencePackBuilder().build({
      repoPath: repo,
      workspaceResolution: "current_repo"
    });

    expect(pack.importantFiles).not.toContain(path.join("node_modules", "pkg", "index.js"));
    expect(pack.importantFiles).not.toContain(path.join(".git", "config"));
    expect(pack.importantFiles).not.toContain(path.join("src", ".DS_Store"));
    expect(pack.importantFiles).not.toContain(path.join("src", "image.png"));
    expect(pack.importantFiles).not.toContain(".env");
    expect(pack.importantFiles).not.toContain("private.key");
    expect(pack.skippedPaths.some((item) => item.path.includes(".DS_Store") && item.reason === "system metadata")).toBe(true);
    expect(pack.skippedPaths.some((item) => item.path.includes("image.png") && item.reason === "non-text or binary extension")).toBe(true);
    expect(pack.skippedPaths.some((item) => item.path.includes("outside-link") && item.reason === "symlink")).toBe(true);
    expect(pack.riskFlags).toContain("sensitive_or_unsafe_paths_skipped");
  });

  it("redacts secret-like values from otherwise safe text files", async () => {
    const repo = await createFixtureRepo();

    const pack = await new RepoEvidencePackBuilder().build({
      repoPath: repo,
      workspaceResolution: "current_repo"
    });

    const configSnippet = pack.snippets.find((snippet) => snippet.path === "config.json");
    expect(configSnippet?.excerpt).toContain("[REDACTED]");
    expect(configSnippet?.excerpt).not.toContain("super-secret-token");
    expect(pack.redactions).toContainEqual({
      path: "config.json",
      count: 1,
      reason: "secret-like value redacted"
    });
  });

  it("blocks direct path traversal reads", async () => {
    const repo = await createFixtureRepo();
    const read = await new RepoSafeFileReader(repo).readText("../outside.txt");

    expect(read).toEqual({ path: "../outside.txt", skipped: "outside repo" });
  });

  it("classifies plain repo audit questions without slash commands", () => {
    const classifier = new ChatIntentClassifier();

    expect(classifier.classify("what tests exist in this repo?").intent).toBe("workspace_repo_audit");
    expect(classifier.classify("what is risky in this repo?").intent).toBe("workspace_repo_audit");
    expect(classifier.classify("fix this repo").intent).toBe("workspace_repo_audit");
    expect(classifier.classify("what tests exist in canvas-helper?", { knownWorkspaces: ["canvas-helper"] }).workspace).toBe("canvas-helper");
  });
});
