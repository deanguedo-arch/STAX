import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { MockProvider } from "../src/providers/MockProvider.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-runtime-"));
}

describe("RaxRuntime", () => {
  it("runs the mock happy path through critic, formatter, validation, and logging", async () => {
    const root = await tempRoot();
    const provider = new MockProvider();
    const runtime = await createDefaultRuntime({
      rootDir: root,
      provider,
      config: {
        runtime: { logRuns: true },
        model: { provider: "mock", generationModel: "mock-model", timeoutMs: 10000 },
        limits: { maxCriticPasses: 1 }
      }
    });

    const output = await runtime.run(
      "Extract this as signals: Dean trained jiu jitsu Saturday for 90 minutes."
    );

    expect(output.mode).toBe("allow");
    expect(output.agent).toBe("intake");
    expect(output.validation.valid).toBe(true);
    expect(provider.calls).toHaveLength(3);

    const runDir = path.join(root, "runs", output.createdAt.slice(0, 10), output.runId);
    await expect(fs.stat(path.join(runDir, "trace.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(runDir, "final.md"))).resolves.toBeTruthy();
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      runId: string;
      provider: string;
      selectedAgent: string;
      policiesApplied: string[];
    };
    expect(trace.runId).toBe(output.runId);
    expect(trace.provider).toBe("mock");
    expect(trace.selectedAgent).toBe("intake");
    expect(trace.policiesApplied.length).toBeGreaterThan(0);
  });

  it("refuses unsafe requests without model calls", async () => {
    const root = await tempRoot();
    const provider = new MockProvider();
    const runtime = await createDefaultRuntime({ rootDir: root, provider });

    const output = await runtime.run("Identify this person and find their address.");

    expect(output.mode).toBe("refuse");
    expect(output.agent).toBe("boundary");
    expect(provider.calls).toHaveLength(0);
  });

  it("retrieves approved memory and logs it in the run folder", async () => {
    const root = await tempRoot();
    const store = new MemoryStore(root);
    await store.add({
      type: "project",
      content: "Dean training context",
      confidence: "high",
      approved: true,
      approvedBy: "test",
      approvalReason: "Stable project context for runtime retrieval test.",
      neverExpireJustification: "Test fixture memory.",
      tags: ["Dean"]
    });
    const runtime = await createDefaultRuntime({ rootDir: root });

    const output = await runtime.run("Analyze Dean training context.");

    const runDir = path.join(root, "runs", output.createdAt.slice(0, 10), output.runId);
    const retrieved = JSON.parse(
      await fs.readFile(path.join(runDir, "retrieved_memory.json"), "utf8")
    ) as Array<{ content: string }>;
    expect(retrieved.map((item) => item.content)).toContain("Dean training context");
  });
});
