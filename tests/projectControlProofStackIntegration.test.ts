import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";

function packet(input: {
  task: string;
  repoEvidence?: string;
  commandEvidence?: string;
  codexReport?: string;
}): string {
  return [
    `Task: ${input.task}`,
    "",
    "Repo Evidence:",
    input.repoEvidence ?? "None supplied.",
    "",
    "Command Evidence:",
    input.commandEvidence ?? "None supplied.",
    "",
    "Codex Report:",
    input.codexReport ?? "None supplied."
  ].join("\n");
}

describe("project_control proof stack integration", () => {
  it("surfaces diff audit for docs-only implementation claims", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether this implementation fix is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: docs/STAX_9_5_PROMOTION_REPORT.md",
        codexReport: "Codex says the implementation is complete."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Diff audit: reject due to docs_only_implementation_claim");
  });

  it("classifies wrong-repo command evidence inside live project-control output", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether Brightspace proof is valid.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/canvas-helper\n$ npm run ingest:ci\nExit code: 0",
        codexReport: "Codex says Brightspace ingest is proven."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Command evidence classifier: wrong_repo_proof");
  });

  it("maps behavior claims to missing proof when tests are absent", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether behavior is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: src/agents/AnalystAgent.ts",
        codexReport: "Codex says the behavior is verified."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: behavior claim is unsupported because behavior_test, command_evidence_after_diff");
  });

  it("maps visual claims to rendered proof requirements", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether the visual layout fix is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/canvas-helper\nChanged files: projects/sportswellness/workspace/styles.css",
        codexReport: "Codex says the layout is fixed."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: visual claim is unsupported because rendered_visual_proof");
  });

  it("maps memory promotion claims to approval and source-run proof", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether this memory promotion is safe.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
        codexReport: "Codex says it saved this as approved memory because it looked useful."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: memory_promotion claim is unsupported because human_approval, source_run_reference");
  });
});
