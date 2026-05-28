import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { getStaxStatus } from "../src/sidecar/StaxStatus.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

describe("STAX status read", () => {
  it("labels stored status as last-known and points users to a fresh gate", async () => {
    const repoPath = await createTempGitRepo("stax-status-last-known-");
    await attachStaxToRepo(repoPath);

    const output = await getStaxStatus(repoPath);

    expect(output).toContain("## STAX Status Read");
    expect(output).toContain("Mode: last-known status read");
    expect(output).toContain("Fresh Audit: no");
    expect(output).toContain("Scope: this command reads stored sidecar status");
    expect(output).toContain("To force a current audit");
  });

  it("marks status stale when the stored commit differs from the current commit", async () => {
    const repoPath = await createTempGitRepo("stax-status-stale-commit-");
    await attachStaxToRepo(repoPath);
    const storedStatus = JSON.parse(await fs.readFile(path.join(repoPath, ".stax", "config.json"), "utf8")) as {
      commitSha: string;
    };

    await commitFile(repoPath, "src/app.ts", "export const changed = true;\n");

    const output = await getStaxStatus(repoPath);

    expect(output).toContain("Status Freshness: stale");
    expect(output).toContain(storedStatus.commitSha.slice(0, 12));
    expect(output).toContain("does not match current commit");
  });

  it("marks status possibly stale when the current worktree has uncommitted changes", async () => {
    const repoPath = await createTempGitRepo("stax-status-dirty-worktree-");
    await attachStaxToRepo(repoPath);
    execFileSync("git", ["add", ".gitignore", "AGENTS.md", ".stax/status.json"], { cwd: repoPath });
    execFileSync("git", ["commit", "-m", "attach stax"], { cwd: repoPath });
    const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoPath }).toString().trim();
    const configPath = path.join(repoPath, ".stax", "config.json");
    const config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
    await fs.writeFile(configPath, `${JSON.stringify({ ...config, commitSha: currentCommit }, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(repoPath, "README.md"), "# test repo\n\nlocal edit\n", "utf8");

    const output = await getStaxStatus(repoPath);

    expect(output).toContain("Status Freshness: possibly stale");
    expect(output).toContain("current worktree has uncommitted changes");
  });
});
