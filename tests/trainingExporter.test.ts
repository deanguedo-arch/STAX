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
  });
});
