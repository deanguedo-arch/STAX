import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatSession } from "../src/chat/ChatSession.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
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
});
