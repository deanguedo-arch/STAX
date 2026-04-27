import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatSession } from "../src/chat/ChatSession.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { buildOperationReceipt } from "../src/operator/OperationReceipt.js";
import { OperationFormatter } from "../src/operator/OperationFormatter.js";
import { OperationReceiptValidator } from "../src/operator/OperationReceiptValidator.js";
import type { OperationExecutionResult, OperationPlan } from "../src/operator/OperationSchemas.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-chat-operator-receipt-"));
}

function basePlan(overrides: Partial<OperationPlan> = {}): OperationPlan {
  return {
    operationId: "op_receipt_fixture",
    operatorVersion: "v1B",
    intent: "workspace_repo_audit",
    originalInput: "what tests exist in this repo?",
    workspace: "canvas-helper",
    objective: "Inspect tests without running linked repo commands.",
    operationsToRun: ["RepoEvidencePack.build"],
    riskLevel: "low",
    executionClass: "low_risk_artifact_creating",
    requiresConfirmation: false,
    evidenceRequired: ["repo evidence pack"],
    outputContract: ["receipt"],
    reasonCodes: ["repo_tests_question"],
    confidence: "high",
    ...overrides
  };
}

function baseResult(overrides: Partial<OperationExecutionResult> = {}): OperationExecutionResult {
  return {
    executed: true,
    blocked: false,
    deferred: false,
    actionsRun: ["OperationRiskGate", "RepoEvidencePack.build"],
    artifactsCreated: [],
    evidenceChecked: ["OperationPlan", "repo:package.json", "repo-script:test", "repo-test:tests/index.test.ts"],
    result: "Read-only repo evidence pack.",
    risks: [],
    nextAllowedActions: ["Run tests explicitly if proof is needed."],
    ...overrides
  };
}

async function createLinkedRepo(rootDir: string): Promise<string> {
  const linkedRepo = path.join(rootDir, "linked-canvas");
  await fs.mkdir(path.join(linkedRepo, "tests"), { recursive: true });
  await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
  await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n", "utf8");
  await fs.writeFile(path.join(linkedRepo, "tests", "canvas.test.ts"), "expect(true).toBe(true);\n", "utf8");
  return linkedRepo;
}

describe("Chat Operator v1B operation receipts", () => {
  it("builds a receipt that separates verified repo facts from unverified test execution", () => {
    const receipt = buildOperationReceipt(basePlan(), baseResult());
    const validation = new OperationReceiptValidator().validate(receipt);

    expect(validation.valid).toBe(true);
    expect(receipt.claimsVerified.map((claim) => claim.claim)).toEqual(expect.arrayContaining([
      "package.json scripts were extracted read-only.",
      "Test files were enumerated read-only."
    ]));
    expect(receipt.claimsNotVerified.join(" ")).toContain("pass/fail is unknown");
    expect(receipt.fakeCompleteRisks.join(" ")).toContain("does not prove tests pass");
  });

  it("rejects fake-complete receipts that claim test success from vague evidence", () => {
    const receipt = buildOperationReceipt(basePlan(), baseResult());
    receipt.claimsVerified.push({
      claim: "Tests passed and the implementation is complete.",
      evidenceRefs: ["Repo evidence pack"]
    });

    const validation = new OperationReceiptValidator().validate(receipt);

    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("vague evidence");
    expect(validation.issues.join(" ")).toContain("Completion-like verified claim");
  });

  it("requires receipts to say found tests were not run", () => {
    const receipt = buildOperationReceipt(basePlan(), baseResult());
    receipt.claimsNotVerified = receipt.claimsNotVerified.filter((claim) => !/Tests were found/i.test(claim));

    const validation = new OperationReceiptValidator().validate(receipt);

    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("pass/fail is unknown");
  });

  it("renders outcome header before receipt details", () => {
    const output = new OperationFormatter().format(basePlan(), baseResult());

    expect(output.indexOf("## Direct Answer")).toBeLessThan(output.indexOf("## Receipt"));
    expect(output).toContain("## Direct Answer");
    expect(output).toContain("pass/fail is unknown");
    expect(output).toContain("## One Next Step");
    expect(output).toContain("Run `npm test`");
    expect(output).toContain("paste back the full output");
    expect(output).toContain("## Proof Status");
    expect(output).toContain("partial");
    expect(output).toContain("ProblemMovement: needs_evidence");
  });

  it("prioritizes failed proof command evidence over generic test commands", () => {
    const output = new OperationFormatter().format(
      basePlan({
        originalInput: [
          "Brightspace battle loop evidence: npm run ingest:ci failed during npm run build.",
          "Error: Cannot find module @rollup/rollup-darwin-arm64 from node_modules/rollup/dist/native.js.",
          "Do not propose deleting node_modules or running npm install unless it is human-approved."
        ].join(" "),
        workspace: "brightspacequizexporter",
        reasonCodes: ["workspace_risk_question"]
      }),
      baseResult({
        evidenceChecked: [
          "OperationPlan",
          "RepoPath: /tmp/brightspacequizexporter",
          "repo:package.json",
          "repo-script:build",
          "repo-script:test",
          "repo-script:ingest:ci",
          "command-evidence:cmd-1:npm run ingest:ci:failed:human_pasted_command_output"
        ],
        result: "Read-only repo evidence pack with stored command evidence.",
        risks: []
      })
    );

    expect(output).toContain("`npm run ingest:ci` failed");
    expect(output).toContain("@rollup/rollup-darwin-arm64");
    expect(output).toContain("dependency/install integrity blocker");
    expect(output).toContain("Run `npm ls @rollup/rollup-darwin-arm64 rollup vite`");
    expect(output).not.toContain("Run `npm test`");
    expect(output).toContain("paste back the full output");
    expect(output).toContain("ProblemMovement: needs_evidence");
  });

  it("moves from completed dependency inspection to a human approval boundary", () => {
    const output = new OperationFormatter().format(
      basePlan({
        originalInput: [
          "Brightspace battle loop evidence update: npm run ingest:ci failed during build with Cannot find module @rollup/rollup-darwin-arm64.",
          "We ran npm ls @rollup/rollup-darwin-arm64 rollup vite. It exited 0 and showed vite@7.3.1 and rollup@4.59.0, but did not list @rollup/rollup-darwin-arm64.",
          "Do not propose npm install/delete node_modules unless labeled human-approved dependency repair."
        ].join(" "),
        workspace: "brightspacequizexporter",
        reasonCodes: ["workspace_risk_question"]
      }),
      baseResult({
        evidenceChecked: [
          "OperationPlan",
          "RepoPath: /tmp/brightspacequizexporter",
          "repo:package.json",
          "repo-script:build",
          "repo-script:test",
          "repo-script:ingest:ci",
          "command-evidence:cmd-1:npm run ingest:ci:failed:human_pasted_command_output"
        ],
        result: "Read-only repo evidence pack with stored command evidence.",
        risks: []
      })
    );

    expect(output).toContain("dependency inspection has already been supplied");
    expect(output).toContain("Ask for human approval to repair the missing Rollup optional dependency");
    expect(output).not.toContain("Run `npm ls @rollup/rollup-darwin-arm64 rollup vite`");
    expect(output).not.toContain("Run `npm test`");
    expect(output).toContain("paste back the approval decision");
    expect(output).toContain("ProblemMovement: needs_evidence");
  });

  it("rejects receipt-first output without a direct outcome answer", () => {
    const output = new OperationFormatter().format(basePlan(), baseResult())
      .replace(/## Direct Answer[\s\S]*?## Receipt\n/, "## Receipt\n");

    const validation = new OperationReceiptValidator().validateMarkdown(output);

    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("Missing receipt heading: ## Direct Answer");
  });

  it("rejects generic next actions even when receipt sections are present", () => {
    const output = new OperationFormatter().format(basePlan(), baseResult())
      .replace(/## One Next Step\n- [^\n]+/, "## One Next Step\n- review the evidence");

    const validation = new OperationReceiptValidator().validateMarkdown(output);

    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("too generic");
  });

  it("requires manual command steps to say what to paste back", () => {
    const output = new OperationFormatter().format(basePlan(), baseResult())
      .replace(/ and paste back the full output, exit code if available, and failing test names if any\./, ".");

    const validation = new OperationReceiptValidator().validateMarkdown(output);

    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("paste back");
  });

  it("renders validated receipt sections for plain-English repo test questions", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = await createLinkedRepo(rootDir);
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: linkedRepo, use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what tests exist in this repo?");
    const validation = new OperationReceiptValidator().validateMarkdown(result.output);

    expect(validation.valid).toBe(true);
    expect(result.output).toMatch(/^## Direct Answer/);
    expect(result.output).toContain("STAX found test/script evidence");
    expect(result.output).toContain("## One Next Step");
    expect(result.output).toContain("Run `npm test`");
    expect(result.output).toContain("paste back the full output");
    expect(result.output).toContain("ProblemMovement: needs_evidence");
    expect(result.output.indexOf("## Direct Answer")).toBeLessThan(result.output.indexOf("## Receipt"));
    expect(result.output).toContain("## Operation");
    expect(result.output).toContain("## Claims Verified");
    expect(result.output).toContain("## Claims Not Verified");
    expect(result.output).toContain("Tests were found, but no test command was executed");
    expect(result.output).toContain("Finding test scripts or test files does not prove tests pass.");
  });

  it("renders blocked requests as no-action direct answers", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("approve all memory candidates");
    const validation = new OperationReceiptValidator().validateMarkdown(result.output);

    expect(validation.valid).toBe(true);
    expect(result.output).toMatch(/^## Direct Answer/);
    expect(result.output).toContain("Blocked. STAX did not execute the requested operation");
    expect(result.output).toContain("## One Next Step");
    expect(result.output).toContain("npm run rax -- learn queue");
    expect(result.output).toContain("paste back the output");
    expect(result.output).toContain("## Proof Status\nblocked");
    expect(result.output).toContain("ProblemMovement: blocked");
  });
});
