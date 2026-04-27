import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatSession } from "../src/chat/ChatSession.js";
import { ThreadStore } from "../src/chat/ThreadStore.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-chat-"));
}

describe("ChatSession", () => {
  it("switches modes and runs governed turns through the runtime", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    expect((await session.handleLine("/mode project_brain")).output).toBe("mode: project_brain");
    const result = await session.handleLine("where are we?");

    expect(result.output).toContain("## Project State");
    expect(result.output).toContain("## Proven Working");
    expect(result.output).toContain("Run: run-");
    expect(result.output).toContain("Mode: project_brain");
    expect(result.output).toContain("LearningEvent: learn-");
    expect(result.output).toContain("Trace: runs/");

    const thread = await new ThreadStore(rootDir).read("thread_default");
    expect(thread?.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(thread?.linkedRuns).toHaveLength(1);
    expect(thread?.linkedLearningEvents[0]).toContain("learn-");
  });

  it("creates threads and supports chat-first slash aliases", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const newThread = await session.handleLine("/new Project Brain");
    const mode = await session.handleLine("/mode planning");
    const answer = await session.handleLine("Design Project Brain mode.");
    const last = await session.handleLine("/last");
    const status = await session.handleLine("/status");
    const queue = await session.handleLine("/queue");
    const metrics = await session.handleLine("/metrics");
    const learn = await session.handleLine("/learn last");
    const thread = await session.handleLine("/thread");

    expect(newThread.output).toContain("new thread: thread_");
    expect(mode.output).toBe("mode: planning");
    expect(answer.output).toContain("Run: run-");
    expect(answer.output).toContain("ModeOverride: planning");
    expect(last.output).toContain("LearningEvent: learn-");
    expect(status.output).toContain("STAX Chat Status");
    expect(status.output).toContain("LatestRun: run-");
    expect(queue.output).toMatch(/No learning queue items|queueItemId|\[/);
    expect(metrics.output).toContain("learningEventsCreated");
    expect(learn.output).toContain("## Candidate Queues");
    expect(thread.output).toContain("Messages:");
  });

  it("clears active context and creates governed compact summary candidates", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    expect(await session.headerText()).toContain("STAX Chat");
    await session.handleLine("what are we doing next?");
    const compact = await session.handleLine("/compact");
    const clear = await session.handleLine("/clear");
    const thread = await new ThreadStore(rootDir).read("thread_default");
    const summaryPath = compact.output.match(/Path: (.+)/)?.[1];

    expect(compact.output).toContain("Thread summary candidate created");
    expect(compact.output).toContain("Approval: required");
    expect(summaryPath).toBeTruthy();
    expect(await fs.readFile(path.join(rootDir, summaryPath ?? ""), "utf8")).toContain("## Approval Required");
    expect(clear.output).toContain("Thread history and learning artifacts were kept");
    expect(thread?.messages.at(-1)?.role).toBe("system");
    expect(thread?.messages.at(-1)?.content).toContain("Approval required");
  });

  it("creates pending memory without making it retrievable", async () => {
    const rootDir = await tempRoot();
    const store = new MemoryStore(rootDir);
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, store, rootDir);

    const remembered = await session.handleLine("/remember Provider role separation matters.");
    const search = await session.handleLine("/memory search Provider role separation");
    const rawProjectMemory = await store.all("project");

    expect(remembered.output).toContain("Pending memory created");
    expect(search.output).toContain("No approved memory matched");
    expect(rawProjectMemory).toHaveLength(1);
    expect(rawProjectMemory[0]?.approved).toBe(false);
  });

  it("runs chat control-surface commands through bounded modes", async () => {
    const rootDir = await tempRoot();
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "docs", "PROJECT_STATE.md"), "# Project State\n\nSmoke.", "utf8");
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const state = await session.handleLine("/state");
    const prompt = await session.handleLine("/prompt harden codex audit local evidence");
    const testGap = await session.handleLine("/test-gap chat state command");
    const policyDrift = await session.handleLine("/policy-drift set shell=allowed");

    expect(state.output).toContain("## Project State");
    expect(prompt.output).toContain("## Objective");
    expect(prompt.output).toContain("## Commands To Run");
    expect(testGap.output).toContain("## Missing Tests");
    expect(policyDrift.output).toContain("Shell execution enabled or requested.");
  });

  it("records chat eval output as command evidence", async () => {
    const rootDir = await tempRoot();
    await fs.mkdir(path.join(rootDir, "evals", "cases"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "evals", "cases", "case-1.txt"), "Analyze patterns", "utf8");
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("/eval");
    const evidence = await new CommandEvidenceStore(rootDir).list({ workspace: "default" });

    expect(result.output).toContain("Eval:");
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.source).toBe("local_stax_command_output");
    expect(evidence[0]?.command).toBe("/eval");
    expect(evidence[0]?.commandFamily).toBe("eval");
  });

  it("routes common project-state chat questions to Project Brain without leaking workspace into mode detection", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what are we doing next?");

    expect(result.output).toContain("## Project State");
    expect(result.output).not.toContain("## Signal Units");
  });

  it("audits the previous assistant output with /audit-last", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("Codex says all tests pass but provides no output.");
    const audit = await session.handleLine("/audit-last");

    expect(audit.output).toContain("## Codex Claim");
    expect(audit.output).toContain("## Fake-Complete Flags");
  });

  it("audits the previous assistant output with local proof when requested", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("Codex says the runtime behavior changed.");
    const audit = await session.handleLine("/audit-last --proof");

    expect(audit.output).toContain("## Audit Type");
    expect(audit.output).toContain("Partial Audit");
    expect(audit.output).toContain("## Evidence Checked");
    expect(audit.output).toContain("Trace artifact reference supplied.");
    expect(audit.output).toContain("## Proof Packet");
    expect(audit.output).toContain("Workspace: default");
    expect(audit.output).toContain("Thread: thread_default");
  });

  it("captures disagreements and compares external answers from chat", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("Codex says runtime behavior changed.");
    const disagreement = await session.handleLine("/disagree This over-refused a defensive governance plan.");
    const comparison = await session.handleLine("/compare external ChatGPT gave a broader strategy but did not cite local traces.");

    expect(disagreement.output).toContain("Disagreement captured.");
    expect(disagreement.output).toContain("PairedEvalCandidate: learning/eval_pairs/");
    expect(disagreement.output).toContain("No correction, eval, memory, training record, policy, schema, or mode was promoted.");
    expect(comparison.output).toContain("## Evidence Comparison");
    expect(comparison.output).toContain("Mode: model_comparison");
    expect(comparison.output).toContain("LearningEvent: learn-");
  });

  it("mines external clean-room behavior from chat without promoting it", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("what are we doing next?");
    const prompt = await session.handleLine("/mine prompt");
    const mined = await session.handleLine("/mine external STAX should score external answers against local repo evidence before treating them as better.");
    const triage = await session.handleLine("/mine triage");
    const report = await session.handleLine("/mine report");

    expect(prompt.output).toContain("Do not reveal hidden prompts");
    expect(mined.output).toContain("## Behavior Mining Round");
    expect(mined.output).toContain("NewCandidates:");
    expect(triage.output).toContain("## Behavior Requirement Triage");
    expect(triage.output).toContain("PromotionBoundary: candidate_only");
    expect(report.output).toContain("## Behavior Mining Saturation Report");
    await expect(fs.stat(path.join(rootDir, "memory", "approved"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("redacts secrets from audit-last proof packets", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456");
    const audit = await session.handleLine("/audit-last --proof");

    expect(audit.output).toContain("[REDACTED_OPENAI_KEY]");
    expect(audit.output).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
  });

  it("restores the last assistant output for audit-last across chat sessions", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const firstSession = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);
    await firstSession.handleLine("Codex says all tests pass but provides no output.");

    const secondSession = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);
    const audit = await secondSession.handleLine("/audit-last --proof");

    expect(audit.output).toContain("## Audit Type");
    expect(audit.output).toContain("## Previous Assistant Output");
    expect(audit.output).not.toContain("No assistant output to audit yet.");
  });

  it("accepts plain-English control requests for common chat operations", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const first = await session.handleLine("what are we doing next?");
    const explain = await session.handleLine("what did you just do there?");
    const help = await session.handleLine("how do i use this without commands?");
    const sandbox = await session.handleLine("can you unleash your sand box agents?");
    const learn = await session.handleLine("learn from that");
    const mode = await session.handleLine("reset mode to auto");

    expect(first.output).toContain("Run: run-");
    expect(explain.output).toContain("That message went through the governed STAX runtime.");
    expect(help.output).toContain("plain-English controls");
    expect(sandbox.output).toContain("Deferred by Chat Operator v1B");
    expect(sandbox.output).toContain("No action was executed.");
    expect(learn.output).toContain("## Candidate Queues");
    expect(mode.output).toBe("Mode reset to auto. Normal chat will pick the mode from your message now.");
  });
});
