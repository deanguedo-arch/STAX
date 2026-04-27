import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatIntentClassifier } from "../src/operator/ChatIntentClassifier.js";
import { ChatSession } from "../src/chat/ChatSession.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { ReviewRouter } from "../src/review/ReviewRouter.js";
import type { ReviewSource } from "../src/review/ReviewSchemas.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-chat-operator-"));
}

function reviewSource(overrides: Partial<ReviewSource> = {}): ReviewSource {
  return {
    sourceId: "operator-review-source",
    sourceType: "patch_proposal",
    sourcePath: "learning/lab/patches/operator-review-source.json",
    content: "Enable shell=allowed and auto-approve memory from chat.",
    targetPaths: [],
    failureTypes: [],
    riskTags: [],
    evidencePaths: [],
    repeatedCount: 0,
    synthetic: false,
    approvalState: "candidate",
    ...overrides
  };
}

describe("Chat Operator v1A", () => {
  it("classifies the agreed natural-language intents", () => {
    const classifier = new ChatIntentClassifier();

    expect(classifier.classify("audit canvas-helper", { knownWorkspaces: ["canvas-helper"] }).intent).toBe("audit_workspace");
    expect(classifier.classify("what needs my judgment?").intent).toBe("judgment_digest");
    expect(classifier.classify("what did the last run prove?").intent).toBe("audit_last_proof");
    expect(classifier.classify("hello, can you reason with me?").executionClass).toBe("fallback");
    expect(classifier.classify("approve all memory candidates").executionClass).toBe("hard_block");
    expect(classifier.classify("stress test planning").executionClass).toBe("review_only");
  });

  it("audits an existing workspace without slash commands", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n\nWorkspace proof.", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit canvas-helper");

    expect(result.output).toContain("Operation: audit_workspace");
    expect(result.output).toContain("Workspace: canvas-helper");
    expect(result.output).toContain("RepoSummary.summarize");
    expect(result.output).toContain("## Audit Type");
    expect(result.output).toContain("Mode: codex_audit");
    expect(result.output).toContain("Promotions still require explicit CLI approval commands.");
    expect(result.output).not.toContain("## Signal Units");
  });

  it("does not audit the wrong repo when a named workspace is missing", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit canvas-helper");

    expect(result.output).toContain("Operation: audit_workspace");
    expect(result.output).toContain("Workspace audit was not run.");
    expect(result.output).toContain("did not fall back to another repo");
    await expect(fs.stat(path.join(rootDir, "runs"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("shows current judgment items without refreshing or mutating review state", async () => {
    const rootDir = await tempRoot();
    const router = new ReviewRouter(rootDir);
    await router.route(reviewSource(), { apply: true });
    const beforeLedger = await fs.readdir(path.join(rootDir, "review", "ledger"));
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what needs my judgment?");
    const afterLedger = await fs.readdir(path.join(rootDir, "review", "ledger"));

    expect(result.output).toContain("Operation: judgment_digest");
    expect(result.output).toContain("ReviewQueue.list");
    expect(result.output).toContain("hard_block");
    expect(result.output).toContain("did not refresh, apply, approve, reject, archive, or promote anything");
    expect(afterLedger.sort()).toEqual(beforeLedger.sort());
  });

  it("audits what the last run proved without slash commands", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("Codex says runtime behavior changed.");
    const result = await session.handleLine("what did the last run prove?");

    expect(result.output).toContain("Operation: audit_last_proof");
    expect(result.output).toContain("auditLastWithProof");
    expect(result.output).toContain("## Proof Packet");
    expect(result.output).toContain("Mode: codex_audit");
  });

  it("blocks or defers risky and broad natural-language operations", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const blocked = await session.handleLine("approve all memory candidates");
    const deferred = await session.handleLine("stress test planning");

    expect(blocked.output).toContain("ExecutionClass: hard_block");
    expect(blocked.output).toContain("No action was executed");
    expect(deferred.output).toContain("ExecutionClass: review_only");
    expect(deferred.output).toContain("Deferred by Chat Operator v1A");
    await expect(fs.stat(path.join(rootDir, "learning", "lab", "runs"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("falls back to the normal runtime for casual chat", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("hello, can you reason with me?");

    expect(result.output).toContain("Run: run-");
    expect(result.output).not.toContain("## Operator Plan");
  });
});
