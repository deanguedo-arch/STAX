import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachStaxToRepo, STAX_AGENTS_SECTION_MARKER } from "../src/sidecar/AttachStax.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

describe("STAX sidecar attach and gate", () => {
  it("attaches idempotently and does not overwrite existing AGENTS.md", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-attach-");
    await fs.writeFile(path.join(repoPath, "AGENTS.md"), "# Existing Instructions\n\nKeep this.\n", "utf8");

    const first = await attachStaxToRepo(repoPath);
    const second = await attachStaxToRepo(repoPath);
    const agents = await fs.readFile(path.join(repoPath, "AGENTS.md"), "utf8");

    expect(first.sidecarPath).toBe(path.join(repoPath, ".stax"));
    expect(second.appendedAgentsProtocol).toBe(false);
    expect(agents).toContain("Keep this.");
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_MARKER, "g"))?.length).toBe(1);
    await expect(fs.stat(path.join(repoPath, ".stax", "config.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "events"))).resolves.toBeTruthy();
  });

  it("rejects a diff with a missing Codex report and writes sidecar status", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-missing-report-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 2;\n", "utf8");

    const status = await runStaxGate({ repoPath });

    expect(status.verdict).toBe("Reject");
    expect(status.exitCode).toBe(1);
    expect(status.statusMarkdown).toContain("Diff exists but .stax/codex-report.md is missing");
    await expect(fs.stat(path.join(repoPath, ".stax", "status.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "status.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "next-codex-prompt.md"))).resolves.toBeTruthy();
  });

  it("rejects fake-complete reports without local command evidence", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-fake-complete-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 3;\n", "utf8");
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: update app",
        "Files changed: src/app.ts",
        "Tests added: none",
        "Commands run: npm test",
        "Command output summary with exit codes: tests passed",
        "What is verified: done and complete",
        "What is weak/provisional: none",
        "What is unverified: none",
        "Risks: none",
        "One next action: accept"
      ].join("\n"),
      "utf8"
    );

    const status = await runStaxGate({ repoPath });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toMatch(/completion without local STAX command evidence|Tests-passed claim/);
  });

  it("rejects docs-only implementation claims", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-docs-only-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "docs/guide.md", "old docs\n");
    await fs.writeFile(path.join(repoPath, "docs/guide.md"), "new docs\n", "utf8");
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: implement runtime behavior",
        "Files changed: docs/guide.md",
        "Tests added: none",
        "Commands run: none",
        "Command output summary with exit codes: none",
        "What is verified: implemented behavior and ready",
        "What is weak/provisional: no tests",
        "What is unverified: none",
        "Risks: none",
        "One next action: accept"
      ].join("\n"),
      "utf8"
    );

    const status = await runStaxGate({ repoPath });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("Docs-only diff cannot prove implementation");
  });
});
