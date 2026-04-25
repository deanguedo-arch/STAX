import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { formatLocalEvidence, type LocalEvidence } from "../src/evidence/LocalEvidenceCollector.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-local-evidence-"));
}

function fixtureEvidence(): LocalEvidence {
  return {
    gitStatus: " M src/foo.ts\n?? docs/report.md",
    gitDiffStat: "src/foo.ts | 2 ++",
    gitDiffNameOnly: ["src/foo.ts"],
    latestEval: {
      path: "evals/eval_results/latest.json",
      total: 3,
      passed: 3,
      failed: 0,
      passRate: 1,
      criticalFailures: 0
    },
    latestRunFolder: "runs/2026-04-25/run-abc",
    projectDocs: [],
    modeMaturity: [],
    errors: []
  };
}

describe("local evidence", () => {
  it("formats local evidence for traceable runtime input", () => {
    const formatted = formatLocalEvidence(fixtureEvidence());

    expect(formatted).toContain("## Local Evidence");
    expect(formatted).toContain("passRate: 1");
    expect(formatted).toContain("src/foo.ts");
  });

  it("lets Codex Audit cite local files and logs local evidence in the run input", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const input = [
      "Audit this Codex report against local read-only evidence.",
      "",
      "## Codex Report",
      "Codex says implementation is complete.",
      "",
      formatLocalEvidence(fixtureEvidence())
    ].join("\n");

    const output = await runtime.run(input, [], { mode: "codex_audit" });
    const runDir = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId);
    const loggedInput = await fs.readFile(path.join(runDir, "input.txt"), "utf8");

    expect(output.output).toContain("Local git/eval/run evidence was collected read-only.");
    expect(output.output).toContain("src/foo.ts");
    expect(loggedInput).toContain("## Local Evidence");
  });
});
