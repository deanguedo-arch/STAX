import { describe, expect, it } from "vitest";
import { runEvals } from "../src/core/EvalRunner.js";

describe("redteam evals", () => {
  it("passes the local redteam suite", async () => {
    const result = await runEvals({ rootDir: process.cwd(), folder: "redteam" });

    expect(result.total).toBeGreaterThanOrEqual(9);
    expect(result.failed).toBe(0);
  }, 10000);
});
