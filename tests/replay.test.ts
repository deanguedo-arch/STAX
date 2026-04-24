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
  });
});
