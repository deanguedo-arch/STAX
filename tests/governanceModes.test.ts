import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { ModeRegistry } from "../src/modes/ModeRegistry.js";
import { validateModeOutput } from "../src/utils/validators.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-governance-"));
}

describe("governance modes", () => {
  it("rejects Project Brain proven-working claims without evidence IDs", () => {
    const result = validateModeOutput(
      "project_brain",
      [
        "## Project State",
        "- state",
        "## Current Objective",
        "- objective",
        "## Proven Working",
        "- Tests pass.",
        "## Unproven Claims",
        "- none",
        "## Recent Changes",
        "- none",
        "## Known Failures",
        "- none",
        "## Risk Register",
        "- none",
        "## Missing Tests",
        "- none",
        "## Fake-Complete Risks",
        "- none",
        "## Next 3 Actions",
        "1. Run tests.",
        "## Codex Prompt",
        "Run a bounded task.",
        "## Evidence Required",
        "- npm test output"
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("evidence ID");
  });

  it("rejects Codex Audit approval when evidence is missing", () => {
    const result = validateModeOutput(
      "codex_audit",
      [
        "## Codex Claim",
        "- all tests pass",
        "## Evidence Found",
        "- None found.",
        "## Missing Evidence",
        "- Test output missing.",
        "## Files Modified",
        "- Unknown",
        "## Tests Added",
        "- Unknown",
        "## Commands Run",
        "- None",
        "## Violations",
        "- Evidence missing.",
        "## Fake-Complete Flags",
        "- Claimed tests pass without output.",
        "## Required Fix Prompt",
        "Return command output.",
        "## Approval Recommendation",
        "- Approve"
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("cannot approve");
  });

  it("retrieves approved decision memory in Project Brain mode and ignores unapproved project memory", async () => {
    const rootDir = await tempRoot();
    const store = new MemoryStore(rootDir);
    await store.add({
      type: "decision",
      content: "Provider role separation must stay explicit.",
      confidence: "high",
      approved: true,
      tags: ["provider", "decision"]
    });
    await store.add({
      type: "project",
      content: "Raw model output should never appear.",
      confidence: "low",
      approved: false,
      tags: ["provider"]
    });
    const runtime = await createDefaultRuntime({ rootDir });

    const output = await runtime.run("Project Brain provider decision review.", [], {
      mode: "project_brain"
    });

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Provider role separation must stay explicit.");
    expect(output.output).not.toContain("Raw model output should never appear.");
    expect(output.output).toContain("ev_001");
  });

  it("does not save raw model output to memory after governance runs", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });

    await runtime.run("Codex says all tests pass but provides no output.", [], {
      mode: "codex_audit"
    });
    const store = new MemoryStore(rootDir);
    const memories = await store.search("");

    expect(memories).toEqual([]);
  });

  it("lists mode maturity and keeps STAX behavior-proven while governance modes are usable", async () => {
    const registry = new ModeRegistry(process.cwd());
    const stax = await registry.inspect("stax_fitness");
    const projectBrain = await registry.inspect("project_brain");
    const maturity = await registry.maturity();

    expect(stax?.maturity).toBe("behavior_proven");
    expect(projectBrain?.maturity).toBe("usable");
    expect(maturity.find((entry) => entry.mode === "project_brain")?.proofGaps.length).toBeGreaterThan(0);
  });
});
