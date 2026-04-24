import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCorrection } from "../src/core/Corrections.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";

describe("createCorrection", () => {
  it("stores a correction record for a run", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-correction-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const run = await runtime.run("Build a project plan.");

    const correction = await createCorrection({
      rootDir,
      runId: run.runId,
      date: run.createdAt.slice(0, 10),
      correctedOutput: "Corrected output",
      reason: "Expected stricter wording"
    });

    expect(correction.runId).toBe(run.runId);
    await expect(fs.stat(correction.path)).resolves.toBeTruthy();
  });
});
