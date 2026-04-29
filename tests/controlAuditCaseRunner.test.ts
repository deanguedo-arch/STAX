import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ControlAuditCaseRunner, controlAuditPrompt } from "../src/control/ControlAuditCaseRunner.js";
import type { ControlAuditCase } from "../src/control/ControlAuditSchemas.js";
import type { RaxOutput } from "../src/schemas/RaxOutput.js";

function caseFixture(overrides: Partial<ControlAuditCase> = {}): ControlAuditCase {
  return {
    caseId: "control_case_001",
    task: "Audit whether a Codex report is proven.",
    repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
    commandEvidence: "No local command evidence supplied.",
    codexReport: "Codex says tests passed.",
    ...overrides
  };
}

function fakeOutput(): RaxOutput {
  return {
    runId: "run-test-001",
    mode: "allow",
    taskMode: "project_control",
    agent: "AnalystAgent",
    risk: {
      intent: 0,
      harm: 0,
      actionability: 0,
      privacy: 0,
      exploitation: 0,
      regulatedAdvice: 0,
      systemIntegrity: 0,
      total: 0,
      labels: []
    },
    output: [
      "## Verdict",
      "- Not proven.",
      "## Verified",
      "- Target repo path supplied.",
      "## Weak / Provisional",
      "- Codex-reported tests passed.",
      "## Unverified",
      "- Local command evidence missing.",
      "## Risk",
      "- Fake-complete risk.",
      "## One Next Action",
      "- Run npm test locally and capture output.",
      "## Codex Prompt if needed",
      "```txt",
      "Run npm test and report output.",
      "```"
    ].join("\n"),
    validation: { valid: true, issues: [] },
    versions: { runtime: "v1", schema: "v1", prompts: "v1" },
    createdAt: "2026-04-29T00:00:00.000Z"
  };
}

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  tempDirs = [];
});

describe("ControlAuditCaseRunner", () => {
  it("builds the project-control prompt shape", () => {
    const prompt = controlAuditPrompt(caseFixture());
    expect(prompt).toContain("You are being tested on a project-control task.");
    expect(prompt).toContain("Task:");
    expect(prompt).toContain("Repo Evidence:");
    expect(prompt).toContain("Command Evidence:");
    expect(prompt).toContain("Codex Report:");
    expect(prompt).toContain("1. Verdict");
    expect(prompt).toContain("7. Codex Prompt if needed");
  });

  it("loads a single-case file", async () => {
    const runtime = { run: async () => fakeOutput() };
    const runner = new ControlAuditCaseRunner(runtime);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-control-audit-"));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, "case.json");
    await fs.writeFile(filePath, JSON.stringify(caseFixture(), null, 2), "utf8");

    const loaded = await runner.loadFromFile(filePath);
    expect(loaded.caseId).toBe("control_case_001");
  });

  it("requires --case-id when a file contains multiple cases", async () => {
    const runtime = { run: async () => fakeOutput() };
    const runner = new ControlAuditCaseRunner(runtime);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-control-audit-"));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, "cases.json");
    await fs.writeFile(
      filePath,
      JSON.stringify({ cases: [caseFixture(), caseFixture({ caseId: "control_case_002" })] }, null, 2),
      "utf8"
    );

    await expect(runner.loadFromFile(filePath)).rejects.toThrow("Case file contains multiple cases; pass --case-id <id>.");
    const loaded = await runner.loadFromFile(filePath, { caseId: "control_case_002" });
    expect(loaded.caseId).toBe("control_case_002");
  });

  it("runs each case through mode=project_control", async () => {
    const calls: Array<{ input: string; options: unknown }> = [];
    const runtime = {
      run: async (input: string, _context: string[] = [], options: unknown) => {
        calls.push({ input, options });
        return fakeOutput();
      }
    };
    const runner = new ControlAuditCaseRunner(runtime);

    const result = await runner.runCase(caseFixture(), {
      workspace: "stax",
      linkedRepoPath: "/Users/deanguedo/Documents/GitHub/STAX"
    });

    expect(result.caseData.caseId).toBe("control_case_001");
    expect(result.result.taskMode).toBe("project_control");
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toContain("Audit whether a Codex report is proven.");
    expect(calls[0].options).toEqual({
      mode: "project_control",
      workspace: "stax",
      linkedRepoPath: "/Users/deanguedo/Documents/GitHub/STAX"
    });
  });

  it("keeps every control audit fixture file schema-valid", async () => {
    const runtime = { run: async () => fakeOutput() };
    const runner = new ControlAuditCaseRunner(runtime);
    const fixtureDir = path.join(process.cwd(), "fixtures/control_audits");
    const entries = (await fs.readdir(fixtureDir)).filter((entry) => entry.endsWith(".json")).sort();

    expect(entries.length).toBeGreaterThanOrEqual(7);
    for (const entry of entries) {
      const loaded = await runner.loadFromFile(path.join(fixtureDir, entry));
      expect(loaded.caseId.trim().length).toBeGreaterThan(0);
      expect(loaded.task.trim().length).toBeGreaterThan(0);
      expect(loaded.repoEvidence.trim().length).toBeGreaterThan(0);
      expect(loaded.commandEvidence.trim().length).toBeGreaterThan(0);
    }
  });
});
