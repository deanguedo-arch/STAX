import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scoreEvidenceText } from "../src/audit/EvidenceSufficiencyScorer.js";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { parsePastedCommandEvidence } from "../src/evidence/CommandOutputParser.js";
import { EvidenceCollector } from "../src/evidence/EvidenceCollector.js";
import { VerificationDebtStore } from "../src/evidence/VerificationDebtStore.js";

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

  it("parses pasted command output as human evidence, not local execution", () => {
    const parsed = parsePastedCommandEvidence(
      "npm run typecheck passed; npm run test:course-shell passed 4/4; npx tsx --test scripts/tests/foo.test.ts passed 1/1."
    );

    expect(parsed.map((item) => item.command)).toEqual([
      "npm run typecheck",
      "npm run test:course-shell",
      "npx tsx --test scripts/tests/foo.test.ts"
    ]);
    expect(parsed.every((item) => item.source === "human_pasted_command_output")).toBe(true);
    expect(parsed[1]?.counts?.testsPassed).toBe(4);
    expect(parsed[1]?.commandFamily).toBe("test");
  });

  it("keeps nearby failure context for pasted command evidence without treating it as local execution", async () => {
    const rootDir = await tempRoot();
    const parsed = parsePastedCommandEvidence(
      [
        "Brightspace proof: npm run ingest:ci failed during build.",
        "Error: Cannot find module @rollup/rollup-darwin-arm64 from node_modules/rollup/dist/native.js.",
        "OPENAI_API_KEY=sk-secretsecretsecretsecretsecret",
        "Do not repair dependencies without human approval."
      ].join("\n")
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.stdout).toContain("@rollup/rollup-darwin-arm64");

    const evidence = await new CommandEvidenceStore(rootDir).record(parsed[0]!);
    const stdout = await fs.readFile(path.join(rootDir, evidence.stdoutPath), "utf8");

    expect(evidence.source).toBe("human_pasted_command_output");
    expect(evidence.summary).toContain("@rollup/rollup-darwin-arm64");
    expect(evidence.summary).toContain("human-pasted command evidence");
    expect(evidence.summary).not.toContain("sk-secret");
    expect(stdout).toContain("@rollup/rollup-darwin-arm64");
    expect(stdout).not.toContain("sk-secret");
  });

  it("stores source/family/count metadata and retrieves by workspace and command", async () => {
    const rootDir = await tempRoot();
    const store = new CommandEvidenceStore(rootDir);
    await store.record({
      command: "npm run test:course-shell",
      args: ["test:course-shell"],
      exitCode: 0,
      source: "human_pasted_command_output",
      status: "passed",
      commandFamily: "test",
      counts: { testsPassed: 4, testsFailed: 0 },
      stdout: "npm run test:course-shell passed 4/4",
      stderr: "",
      summary: "Human-pasted test evidence.",
      workspace: "canvas-helper"
    });

    const matches = await store.list({ workspace: "canvas-helper", command: "npm run test:course-shell" });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.source).toBe("human_pasted_command_output");
    expect(matches[0]?.status).toBe("passed");
    expect(matches[0]?.counts?.testsPassed).toBe(4);
  });

  it("tracks verification debt and satisfies it only with matching command evidence", async () => {
    const rootDir = await tempRoot();
    const debtStore = new VerificationDebtStore(rootDir);
    const commandStore = new CommandEvidenceStore(rootDir);
    const debt = await debtStore.recordOpen({
      workspace: "canvas-helper",
      linkedRepoPath: "/tmp/canvas-helper",
      requiredCommand: "npm run test:e2e",
      reason: "Full e2e proof missing."
    });
    const focused = await commandStore.record({
      command: "npm run test:course-shell",
      args: ["test:course-shell"],
      exitCode: 0,
      stdout: "passed 4/4",
      stderr: "",
      summary: "Focused tests passed.",
      workspace: "canvas-helper"
    });
    expect(await debtStore.satisfyMatching(focused)).toHaveLength(0);

    const e2e = await commandStore.record({
      command: "npm run test:e2e",
      args: ["test:e2e"],
      exitCode: 0,
      stdout: "passed",
      stderr: "",
      summary: "Full e2e passed.",
      workspace: "canvas-helper"
    });
    const satisfied = await debtStore.satisfyMatching(e2e);

    expect(satisfied[0]?.debtId).toBe(debt.debtId);
    expect((await debtStore.list({ workspace: "canvas-helper" }))[0]?.status).toBe("satisfied");
  });
});
