import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runEvals } from "../src/core/EvalRunner.js";

describe("runEvals", () => {
  it("flags drift when output differs from expected", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-eval-"));
    await fs.mkdir(path.join(rootDir, "evals", "cases"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "evals", "expected"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "evals", "cases", "case-1.txt"), "Analyze patterns", "utf8");
    await fs.writeFile(path.join(rootDir, "evals", "expected", "case-1.md"), "not the mock output", "utf8");

    const result = await runEvals({ rootDir });

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0]?.status).toBe("drift");
  });
});
