import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import {
  collectCommandEvidence,
  isDangerousSidecarCommand
} from "../src/sidecar/CommandEvidenceCollector.js";
import { StaxWatcher } from "../src/sidecar/StaxWatcher.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

describe("STAX sidecar watch and collect", () => {
  it("collects successful and failed command evidence", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-collect-");
    await attachStaxToRepo(repoPath);

    const pass = await collectCommandEvidence({
      repoPath,
      command: ["node", "-e", "console.log('ok')"],
      writeLearningEvent: false
    });
    const fail = await collectCommandEvidence({
      repoPath,
      command: ["node", "-e", "process.exit(3)"],
      writeLearningEvent: false
    });

    expect(pass.exitCode).toBe(0);
    expect(fail.exitCode).toBe(3);
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence", pass.stdoutPath))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence", fail.stderrPath))).resolves.toBeTruthy();
  });

  it("blocks dangerous command collection unless allow-risky is explicit", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-risky-");
    await attachStaxToRepo(repoPath);

    expect(isDangerousSidecarCommand(["git", "push"])).toBe(true);
    await expect(
      collectCommandEvidence({
        repoPath,
        command: ["git", "push"],
        writeLearningEvent: false
      })
    ).rejects.toThrow(/Dangerous command blocked/);

    const allowed = await collectCommandEvidence({
      repoPath,
      command: ["echo", "deploy"],
      allowRisky: true,
      writeLearningEvent: false
    });

    expect(allowed.exitCode).toBe(0);
    expect(allowed.warning).toMatch(/allow-risky/);
  });

  it("audits only changed inputs and reports verdict changes", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-watch-");
    await attachStaxToRepo(repoPath);
    const verdicts: string[] = [];
    const watcher = new StaxWatcher({
      repoPath,
      onVerdictChange(status) {
        verdicts.push(status.verdict);
      }
    });

    const first = await watcher.scanOnce();
    const second = await watcher.scanOnce();
    await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), "Objective: inspect\n", "utf8");
    const third = await watcher.scanOnce();

    expect(first.audited).toBe(true);
    expect(second.audited).toBe(false);
    expect(third.audited).toBe(true);
    expect(verdicts.length).toBeGreaterThanOrEqual(1);
  });
});
