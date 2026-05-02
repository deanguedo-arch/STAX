import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import {
  adjudicateRepoTransferCriticalMiss,
  validateRepoTransferRunCaptures
} from "../src/repoTransfer/RepoTransferRun.js";
import {
  scoreRepoTransferTrial,
  validateRepoTransferFixtures
} from "../src/repoTransfer/RepoTransferTrial.js";

describe("repo transfer trial fixtures", () => {
  it("keeps failure patterns, archetypes, candidates, and cases structurally valid", async () => {
    const summary = await validateRepoTransferFixtures();
    expect(summary.status).toBe("passed");
    expect(summary.patternFiles).toBeGreaterThanOrEqual(14);
    expect(summary.patternCount).toBeGreaterThanOrEqual(200);
    expect(summary.archetypeCount).toBe(12);
    expect(summary.candidateRepoCount).toBe(12);
    expect(summary.transferTrialCaseCount).toBe(60);
    expect(summary.archetypeCoverage).toBe(12);
    expect(summary.issues).toEqual([]);
  });

  it("reports transfer coverage before external baselines are captured", async () => {
    const summary = await scoreRepoTransferTrial();
    expect(summary.status).toBe("not_scored_no_external_baseline");
    expect(summary.totalCases).toBe(60);
    expect(summary.patternCoverage.patternCount).toBeGreaterThanOrEqual(200);
    expect(summary.archetypeCoverage.candidateRepoCount).toBe(12);
    expect(summary.usefulInitialPromptRate).toBeNull();
    expect(summary.acceptedDecisionRate).toBeNull();
  });

  it("keeps public repo transfer project-control output out of local repo proof surfaces", async () => {
    const runtime = await createDefaultRuntime();
    const result = await runtime.run(
      [
        "Repo transfer trial case: microsoft_playwright_1_onboarding.",
        "Task: Create a repo onboarding card for microsoft/playwright: language/tooling indicators, proof gates, risky commands, and environment blockers.",
        "Repo Evidence: Public repo name and archetype only; commands are not locally inspected yet.",
        "Command Evidence: None supplied.",
        "Codex Report: None supplied."
      ].join("\n"),
      [],
      {
        mode: "project_control",
        workspace: "STAX",
        linkedRepoPath: "/Users/deanguedo/Documents/GitHub/STAX"
      }
    );

    expect(result.output).toContain("microsoft/playwright");
    expect(result.output).toContain("Onboarding can be drafted as provisional repo intelligence");
    expect(result.output).toContain("Cross-repo evidence risk");
    expect(result.output).not.toContain("ADMISSION-APP");
    expect(result.output).not.toContain("build:pages");
    expect(result.validation.valid).toBe(true);
  });

  it("marks contaminated repo-transfer browser captures invalid before scoring", () => {
    const issues = validateRepoTransferRunCaptures([
      {
        taskId: "storybookjs_storybook_11_onboarding",
        caseId: "storybookjs_storybook_11_onboarding",
        repoFullName: "storybookjs/storybook",
        archetype: "ui_visual_system",
        taskType: "repo_onboarding_card",
        task: "Create a repo onboarding card.",
        suppliedEvidence: "Public repo name and archetype only.",
        expectedBestTraits: ["separates verified from unverified"],
        criticalMissRules: ["wrong repo evidence"],
        prompt: "prompt",
        staxOutput: "## Verdict\nok\n## Verified\nok\n## Weak / Provisional\nok\n## Unverified\nok\n## Risk\nok\n## One Next Action\nok",
        chatgptOutput: [
          "## Verdict",
          "ok",
          "## Verified",
          "ok",
          "## Weak / Provisional",
          "ok",
          "## Unverified",
          "ok",
          "## Risk",
          "ok",
          "## One Next Action",
          "ok",
          "You are raw ChatGPT in a public-repo project-control benchmark.",
          "Case ID: bad",
          "Thought for 7s",
          "laravel/framework"
        ].join("\n")
      },
      {
        taskId: "laravel_framework_10_onboarding",
        caseId: "laravel_framework_10_onboarding",
        repoFullName: "laravel/framework",
        archetype: "php_framework",
        taskType: "repo_onboarding_card",
        task: "Create a repo onboarding card.",
        suppliedEvidence: "Public repo name and archetype only.",
        expectedBestTraits: ["separates verified from unverified"],
        criticalMissRules: ["wrong repo evidence"],
        prompt: "prompt",
        staxOutput: "## Verdict\nok\n## Verified\nok\n## Weak / Provisional\nok\n## Unverified\nok\n## Risk\nok\n## One Next Action\nok",
        chatgptOutput: "## Verdict\nok\n## Verified\nok\n## Weak / Provisional\nok\n## Unverified\nok\n## Risk\nok\n## One Next Action\nok"
      }
    ]);

    expect(issues).toEqual([
      {
        taskId: "storybookjs_storybook_11_onboarding",
        source: "chatgpt",
        issues: ["embedded_benchmark_prompt", "ui_capture_text", "wrong_repo_contamination"]
      }
    ]);
  });

  it("marks missing repo-transfer captures invalid before scoring", () => {
    const issues = validateRepoTransferRunCaptures([
      {
        taskId: "vitejs_vite_2_fake_complete",
        caseId: "vitejs_vite_2_fake_complete",
        repoFullName: "vitejs/vite",
        archetype: "js_build_tooling",
        taskType: "fake_complete_codex_report",
        task: "Audit a fake-complete Codex report.",
        suppliedEvidence: "Codex says tests passed but no command output is supplied.",
        expectedBestTraits: ["rejects fake-complete"],
        criticalMissRules: ["claimed command passed without evidence"],
        prompt: "prompt",
        staxOutput: "## Verdict\nok\n## Verified\nok\n## Weak / Provisional\nok\n## Unverified\nok\n## Risk\nok\n## One Next Action\nok",
        chatgptOutput: ""
      }
    ]);

    expect(issues).toEqual([
      {
        taskId: "vitejs_vite_2_fake_complete",
        source: "chatgpt",
        issues: ["missing_output"]
      }
    ]);
  });

  it("derives critical-miss adjudication instead of hard-coding false", () => {
    const passClaim = adjudicateRepoTransferCriticalMiss(82, "## Verdict\nFixed and tests passed.\n## Verified\nTests passed.\n## Weak / Provisional\nNone.\n## Unverified\nNone.\n## Risk\nLow.\n## One Next Action\nShip it.");
    expect(passClaim.criticalMiss).toBe(true);
    expect(passClaim.reasons).toContain("hard completion/pass claim without uncertainty boundary");

    const bounded = adjudicateRepoTransferCriticalMiss(82, "## Verdict\nNot proven.\n## Verified\nNo command evidence supplied.\n## Weak / Provisional\nCodex report only.\n## Unverified\nTests, cwd, branch, and exit code.\n## Risk\nFake-complete.\n## One Next Action\nAsk Codex for command output.");
    expect(bounded.criticalMiss).toBe(false);
  });
});
