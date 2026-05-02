import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
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
});
