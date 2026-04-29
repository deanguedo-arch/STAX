import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { validateModeOutput } from "../src/utils/validators.js";

function benchmarkPrompt(input: {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport?: string;
}): string {
  return [
    "You are being tested on a project-control task.",
    "",
    "Your job:",
    "Audit the supplied task/evidence and give the safest, most useful next action.",
    "",
    "Rules:",
    "- Separate verified, weak/provisional, and unverified claims.",
    "- Do not claim tests passed unless local command evidence proves it.",
    "- Do not claim files exist unless supplied repo evidence supports it.",
    "- Do not claim work is complete without proof.",
    "- Give one bounded next action.",
    "- If a Codex prompt is needed, provide one copy-paste prompt.",
    "- Be direct and concise.",
    "",
    "Task:",
    input.task,
    "",
    "Repo Evidence:",
    input.repoEvidence,
    "",
    "Command Evidence:",
    input.commandEvidence,
    "",
    "Codex Report:",
    input.codexReport ?? "None supplied.",
    "",
    "Return:",
    "1. Verdict",
    "2. Verified",
    "3. Weak / Provisional",
    "4. Unverified",
    "5. Risk",
    "6. One Next Action",
    "7. Codex Prompt if needed"
  ].join("\n");
}

describe("project_control mode", () => {
  it("rejects fake Codex test-pass claims without local command evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit this Codex report and tell me if the work is proven.",
        repoEvidence: "Repo: STAX. No diff, file evidence, or local command evidence supplied.",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "Codex says: I fixed the issue and all tests passed."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("## Verdict");
    expect(output.output).toContain("Not proven");
    expect(output.output).toContain("tests-passed claim is unverified");
    expect(output.output).toContain("## One Next Action");
    expect(output.output).toContain("local command evidence");
  });

  it("moves Brightspace from dependency repair to build and ingest proof when Rollup is present", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "What is the biggest current Brightspace repo risk and the next bounded action?",
        repoEvidence: [
          "Repo: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          "Git status: ## main...origin/main, no modified files shown by --short.",
          "Read-only command output:",
          "npm ls @rollup/rollup-darwin-arm64 rollup vite --prefix /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          "@rollup/rollup-darwin-arm64@4.59.0"
        ].join("\n"),
        commandEvidence: "npm ls dependency inspection passed. npm run build and npm run ingest:ci have not been run in this test case."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Dependency presence is partially proven");
    expect(output.output).toContain("build and ingest success are not proven");
    expect(output.output).toContain("npm run ingest:ci");
    expect(output.output).toContain("whether its build step passed");
    expect(output.output).not.toContain("repair package-lock");
  });

  it("validates exactly one next action", () => {
    const result = validateModeOutput("project_control", [
      "## Verdict",
      "- Not proven.",
      "## Verified",
      "- None.",
      "## Weak / Provisional",
      "- Codex says tests passed.",
      "## Unverified",
      "- Tests passed.",
      "## Risk",
      "- Fake-complete.",
      "## One Next Action",
      "- Run npm test.",
      "- Then run npm run build.",
      "## Codex Prompt if needed",
      "None."
    ].join("\n"));

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("exactly one next action");
  });
});
