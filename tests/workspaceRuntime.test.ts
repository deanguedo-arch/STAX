import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatSession } from "../src/chat/ChatSession.js";
import { ThreadStore } from "../src/chat/ThreadStore.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-workspace-runtime-"));
}

describe("workspace runtime metadata", () => {
  it("chat runs include active workspace in trace, LearningEvent, and thread", async () => {
    const rootDir = await tempRoot();
    await fs.writeFile(path.join(rootDir, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }), "utf8");
    await fs.mkdir(path.join(rootDir, "src"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "src", "RaxRuntime.ts"), "export const RaxRuntime = true;\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "demo", repoPath: ".", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const status = await session.handleLine("/workspace status");
    const result = await session.handleLine("what are we doing next?");
    const runId = result.output.match(/Run: (run-[^\n]+)/)?.[1] ?? "";
    const runDir = path.join(rootDir, "runs", result.output.match(/Trace: runs\/([^/]+)\//)?.[1] ?? "", runId);
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      workspace?: string;
      linkedRepoPath?: string;
      learningEventId?: string;
    };
    const event = JSON.parse(await fs.readFile(path.join(runDir, "learning_event.json"), "utf8")) as {
      workspace?: string;
    };
    const thread = await new ThreadStore(rootDir).read("thread_default");

    expect(status.output).toContain("Workspace: demo");
    expect(trace.workspace).toBe("demo");
    expect(trace.linkedRepoPath).toBe(rootDir);
    expect(event.workspace).toBe("demo");
    expect(thread?.workspace).toBe("demo");
    expect(trace.learningEventId).toContain("learn-");
  });

  it("/state includes workspace repo summary and falls back when no active workspace exists", async () => {
    const rootDir = await tempRoot();
    await fs.writeFile(path.join(rootDir, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }), "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "demo", repoPath: ".", use: true });
    const session = new ChatSession(await createDefaultRuntime({ rootDir }), new MemoryStore(rootDir), rootDir);

    const state = await session.handleLine("/state");
    expect(state.output).toContain("## Repo Summary");
    expect(state.output).toContain("Workspace repo summary context was supplied");

    const noWorkspaceRoot = await tempRoot();
    const noWorkspace = new ChatSession(await createDefaultRuntime({ rootDir: noWorkspaceRoot }), new MemoryStore(noWorkspaceRoot), noWorkspaceRoot);
    const fallback = await noWorkspace.handleLine("/state");
    expect(fallback.output).toContain("No active workspace");
  });
});
