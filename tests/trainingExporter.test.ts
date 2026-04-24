import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TrainingExporter } from "../src/training/TrainingExporter.js";

describe("TrainingExporter", () => {
  it("exports goldens as SFT JSONL records", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-training-"));
    await fs.mkdir(path.join(rootDir, "goldens"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "goldens", "project_plan.md"),
      "## Objective\nPlan\n\n## Plan\n1. Build\n\n## Tests / Verification\n- Test",
      "utf8"
    );

    const result = await new TrainingExporter(rootDir).exportSft();

    expect(result.count).toBe(1);
    const raw = await fs.readFile(result.path, "utf8");
    expect(JSON.parse(raw.trim()).messages.at(-1).content).toContain("## Objective");
    for (const line of raw.trim().split("\n")) {
      expect(() => JSON.parse(line)).not.toThrow();
      expect(line).not.toContain("undefined");
    }
  });

  it("exports preference JSONL from approved corrections", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-training-pref-"));
    await fs.mkdir(path.join(rootDir, "corrections", "approved"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "corrections", "approved", "corr-1.json"),
      JSON.stringify({
        correctionId: "corr-1",
        runId: "run-1",
        createdAt: new Date().toISOString(),
        originalOutput: "bad output",
        correctedOutput: "good output",
        reason: "chosen follows evidence policy",
        errorType: "assumption_error",
        tags: [],
        approved: true,
        promoteToEval: false,
        promoteToTraining: true
      }),
      "utf8"
    );

    const result = await new TrainingExporter(rootDir).exportPreference();
    const raw = await fs.readFile(result.path, "utf8");
    const record = JSON.parse(raw.trim()) as { chosen: string; rejected: string };

    expect(result.count).toBe(1);
    expect(record.chosen).toBe("good output");
    expect(record.rejected).toBe("bad output");
  });

  it("exports approved corrections as SFT JSONL records", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-training-correction-"));
    await fs.mkdir(path.join(rootDir, "goldens"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "corrections", "approved"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "corrections", "approved", "corr-2.json"),
      JSON.stringify({
        correctionId: "corr-2",
        runId: "run-2",
        createdAt: new Date().toISOString(),
        originalOutput: "bad output",
        correctedOutput: "corrected output",
        reason: "correct the unsupported claim",
        errorType: "hallucination",
        tags: [],
        approved: true,
        promoteToEval: false,
        promoteToTraining: true
      }),
      "utf8"
    );

    const result = await new TrainingExporter(rootDir).exportSft();
    const raw = await fs.readFile(result.path, "utf8");

    expect(raw).toContain("corrected output");
    for (const line of raw.trim().split("\n")) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
