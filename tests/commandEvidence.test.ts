import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scoreEvidenceText } from "../src/audit/EvidenceSufficiencyScorer.js";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { EvidenceCollector } from "../src/evidence/EvidenceCollector.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-command-evidence-"));
}

describe("CommandEvidenceStore", () => {
  it("stores redacted stdout/stderr, truncation flags, and stable hashes", async () => {
    const rootDir = await tempRoot();
    const store = new CommandEvidenceStore(rootDir);
    const input = {
      command: "npm run rax -- eval --regression",
      args: ["--regression"],
      exitCode: 0,
      stdout: "OPENAI_API_KEY=sk-secretsecretsecretsecretsecret\nall passed",
      stderr: "Bearer abcdefghijklmnopqrstuvwxyz",
      summary: "Regression evals passed.",
      workspace: "demo"
    };

    const first = await store.record(input);
    const second = await store.record(input);
    const stdout = await fs.readFile(path.join(rootDir, first.stdoutPath), "utf8");
    const stderr = await fs.readFile(path.join(rootDir, first.stderrPath), "utf8");

    expect(first.commandEvidenceId).toContain("cmd-ev-");
    expect(first.hash).toBe(second.hash);
    expect(first.redactionCount).toBeGreaterThanOrEqual(2);
    expect(stdout).not.toContain("sk-secret");
    expect(stderr).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(stdout).toContain("[REDACTED_OPENAI_KEY]");
  });

  it("truncates large redacted output", async () => {
    const rootDir = await tempRoot();
    const evidence = await new CommandEvidenceStore(rootDir).record({
      command: "npm test",
      args: ["test"],
      exitCode: 1,
      stdout: "x".repeat(250 * 1024),
      stderr: "",
      summary: "Test command failed."
    });

    const stdout = await fs.readFile(path.join(rootDir, evidence.stdoutPath), "utf8");
    expect(evidence.stdoutTruncated).toBe(true);
    expect(stdout).toContain("[TRUNCATED_COMMAND_OUTPUT]");
  });

  it("evidence collect includes command evidence and Verified Audit can cite it narrowly", async () => {
    const rootDir = await tempRoot();
    const command = await new CommandEvidenceStore(rootDir).record({
      command: "npm test",
      args: ["test"],
      exitCode: 0,
      stdout: "10 tests passed",
      stderr: "",
      summary: "npm test passed."
    });

    const collection = await new EvidenceCollector(rootDir).collect();
    const score = scoreEvidenceText([
      "## Local Evidence",
      "- Trace: runs/2026-04-26/run-test/trace.json",
      `- Evidence: ${command.commandEvidenceId}`,
      `- Path: evidence/commands/${command.createdAt.slice(0, 10)}/${command.commandEvidenceId}.json`,
      "- Command: npm test exit code 0",
      "- ClaimSupported: npm test passed for this repo state."
    ].join("\n"));

    expect(collection.collection.items.some((item) => item.sourceType === "command_output")).toBe(true);
    expect(score.canClaimVerifiedAudit).toBe(true);
  });
});
