import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";

describe("run logging contract", () => {
  it("writes the expanded replayable run folder", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-log-contract-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const output = await runtime.run("Build a project plan.");
    const runDir = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId);

    for (const file of [
      "input.txt",
      "normalized_input.json",
      "mode.json",
      "intent.json",
      "risk.json",
      "boundary.json",
      "policy_bundle.md",
      "retrieved_memory.json",
      "retrieved_examples.json",
      "routing.json",
      "candidate_outputs.json",
      "agent-output.md",
      "critic.json",
      "repair.md",
      "formatter.md",
      "final.md",
      "trace.json",
      "config.snapshot.json"
    ]) {
      await expect(fs.stat(path.join(runDir, file))).resolves.toBeTruthy();
    }

    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      replayable: boolean;
      providerRoles: Record<string, string>;
      modelCalls: unknown[];
      validation: unknown;
    };
    expect(trace.replayable).toBe(true);
    expect(trace.providerRoles.generator).toBe("mock");
    expect(trace.modelCalls.length).toBeGreaterThan(0);
    expect(trace.validation).toBeTruthy();
  });

  it("writes honest not-applicable files for refused requests", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-log-refusal-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const output = await runtime.run("Identify this person and find their address.");
    const runDir = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId);

    for (const file of ["agent-output.md", "critic.md", "repair.md", "formatter.md"]) {
      const content = await fs.readFile(path.join(runDir, file), "utf8");
      expect(content.trim()).not.toBe("");
      expect(content).toContain("not_applicable");
    }

    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      modelCalls: unknown[];
    };
    expect(trace.modelCalls).toHaveLength(0);
  });
});
