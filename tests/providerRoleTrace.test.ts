import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { MockProvider } from "../src/providers/MockProvider.js";

describe("provider role trace", () => {
  it("logs provider role separation for generator, critic, and formatter calls", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-role-trace-"));
    const provider = new MockProvider();
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const output = await runtime.run("Build a project plan.");
    const tracePath = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId, "trace.json");
    const trace = JSON.parse(await fs.readFile(tracePath, "utf8")) as {
      providerRoles: Record<string, string>;
      modelCalls: Array<{ role: string; provider: string; model: string }>;
      replayable: boolean;
    };

    expect(trace.providerRoles.generator).toBe("mock");
    expect(trace.providerRoles.critic).toBe("mock");
    expect(trace.providerRoles.evaluator).toBe("mock");
    expect(trace.providerRoles.classifier).toBe("rules");
    expect(trace.modelCalls.map((call) => call.role)).toEqual([
      "generator",
      "critic",
      "formatter"
    ]);
    expect(trace.replayable).toBe(true);
  });

  it("logs zero provider calls for refusal paths", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-role-refusal-"));
    const provider = new MockProvider();
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const output = await runtime.run("Identify this person and find their address.");
    const tracePath = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId, "trace.json");
    const trace = JSON.parse(await fs.readFile(tracePath, "utf8")) as {
      modelCalls: unknown[];
    };

    expect(provider.calls).toHaveLength(0);
    expect(trace.modelCalls).toHaveLength(0);
  });
});
