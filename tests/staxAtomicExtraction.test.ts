import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";

describe("STAX atomic signal extraction", () => {
  it("splits BJJ training and sleep into separate signal units", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-stax-atomic-"));
    const runtime = await createDefaultRuntime({ rootDir });

    const output = await runtime.run(
      "Dean trained BJJ Saturday for 90 minutes and slept 8 hours Sunday.",
      [],
      { mode: "stax_fitness" }
    );

    expect(output.output).toContain("### SU-001");
    expect(output.output).toContain("### SU-002");
    expect(output.output).toContain("- Type: training");
    expect(output.output).toContain("- Type: sleep");
    expect(output.output).toContain("- Timestamp: Saturday");
    expect(output.output).toContain("- Timestamp: Sunday");
    expect(output.output).toContain("Dean trained BJJ for 90 minutes");
    expect(output.output).toContain("Dean slept 8 hours");
    expect(output.output).toContain("Insufficient signals");
    expect(output.output).toContain("Insufficient baseline");
  });
});
