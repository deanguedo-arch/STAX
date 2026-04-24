import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCorrection, promoteCorrection } from "../src/core/Corrections.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";

describe("correction promotion", () => {
  it("creates pending corrections and promotes them to eval/training", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-promotion-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const run = await runtime.run("Build a project plan.");
    const correction = await createCorrection({
      rootDir,
      runId: run.runId,
      correctedOutput: "## Objective\nBetter plan\n\n## Plan\n1. Do it\n\n## Tests / Verification\n- Test it",
      reason: "weak_plan",
      errorType: "weak_plan",
      policyViolated: "core_policy",
      tags: ["planning"]
    });

    expect(correction.path).toContain(path.join("corrections", "pending"));

    const promoted = await promoteCorrection({
      rootDir,
      correctionId: correction.correctionId,
      promoteToEval: true,
      promoteToTraining: true,
      promoteToGolden: true
    });

    expect(promoted.approved).toBe(true);
    await expect(fs.stat(promoted.evalPath!)).resolves.toBeTruthy();
    await expect(fs.stat(promoted.trainingPath!)).resolves.toBeTruthy();
    await expect(fs.stat(promoted.goldenPath!)).resolves.toBeTruthy();
  });
});
