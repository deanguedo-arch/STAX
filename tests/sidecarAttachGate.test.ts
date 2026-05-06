import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachStaxToRepo,
  STAX_AGENTS_SECTION_END_MARKER,
  STAX_AGENTS_SECTION_MARKER,
  upsertAgentsProtocolSection
} from "../src/sidecar/AttachStax.js";
import { getNextCodexPrompt } from "../src/sidecar/NextCodexPrompt.js";
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
    expect(agents).toContain("read `.stax/next-codex-prompt.md`");
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_MARKER, "g"))?.length).toBe(1);
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_END_MARKER, "g"))?.length).toBe(1);
    const config = JSON.parse(await fs.readFile(path.join(repoPath, ".stax", "config.json"), "utf8")) as {
      requireFreshCodexTurnCapture?: boolean;
      runtimeFreshnessMode?: string;
      turnComplianceMode?: string;
    };
    const gitignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
    await expect(fs.stat(path.join(repoPath, ".stax", "config.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "events"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "runtime"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "turns"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "turn-contract.json"))).resolves.toBeTruthy();
    expect(config.requireFreshCodexTurnCapture).toBe(false);
    expect(config.runtimeFreshnessMode).toBe("normal");
    expect(config.turnComplianceMode).toBe("normal");
    expect(gitignore).toContain(".stax/");
  });

  it("updates an existing protocol section instead of appending duplicate stale protocol", () => {
    const existing = [
      "# Existing",
      "",
      STAX_AGENTS_SECTION_MARKER,
      "# Old STAX Protocol",
      "Do old things."
    ].join("\n");

    const updated = upsertAgentsProtocolSection(existing);

    expect(updated).toContain("# Existing");
    expect(updated).toContain("read `.stax/next-codex-prompt.md`");
    expect(updated).not.toContain("Do old things.");
    expect(updated.match(new RegExp(STAX_AGENTS_SECTION_MARKER, "g"))?.length).toBe(1);
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

  it("makes missing runtime capture provisional by default", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-missing-turn-");
    await attachStaxToRepo(repoPath);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Provisional");
    expect(status.weak.join("\n")).toContain("Fresh Codex turn capture is missing");
    expect(status.risk.join("\n")).not.toContain("False Pass risk");
  });

  it("returns the next Codex prompt after running the gate", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-next-prompt-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 2;\n", "utf8");

    const result = await getNextCodexPrompt({ repoPath, runGate: true });

    expect(result.copied).toBe(false);
    expect(result.prompt).toContain("STAX Sidecar rejected or held this task");
    expect(result.prompt).toContain("Update .stax/codex-report.md");
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
