import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { replayRun } from "../src/core/Replay.js";

describe("replayRun", () => {
  it("reproduces the final output from a saved run", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-replay-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const first = await runtime.run("Analyze this pattern: sleep 8 hours twice.");

    const replayed = await replayRun({
      rootDir,
      runId: first.runId,
      date: first.createdAt.slice(0, 10)
    });

    expect(replayed.originalOutput).toBe(first.output);
    expect(replayed.replayedOutput).toBe(first.output);
    expect(replayed.exact).toBe(true);
    expect(replayed.originalRunId).toBe(first.runId);
    expect(replayed.replayRunId).not.toBe(first.runId);
    expect(replayed.outputDiffSummary).toBe("exact match");
    expect(replayed.traceDiffSummary).toContain("mock replay");
  });

  it("ignores non-directory entries while finding a run date", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-replay-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const first = await runtime.run("Analyze this replay with a stray runs file.");
    await fs.writeFile(path.join(rootDir, "runs", ".DS_Store"), "mac metadata", "utf8");

    const replayed = await replayRun({
      rootDir,
      runId: first.runId
    });

    expect(replayed.originalOutput).toBe(first.output);
    expect(replayed.exact).toBe(true);
  });

  it("replays with the mode recorded in the original trace", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-replay-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const first = await runtime.run("Analyze run abc and propose how STAX should improve from it.", [], {
      mode: "learning_unit"
    });

    const replayed = await replayRun({
      rootDir,
      runId: first.runId
    });

    expect(replayed.originalOutput).toBe(first.output);
    expect(replayed.exact).toBe(true);
  });
});
