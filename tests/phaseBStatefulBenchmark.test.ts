import { describe, expect, it } from "vitest";
import {
  buildPhaseBBenchmarkCollection,
  buildPhaseBLocalEvidence,
  phaseBWorkspaceRepoPath,
  type PhaseBCaptureEntry
} from "../src/campaign/PhaseBStatefulBenchmark.js";

describe("PhaseBStatefulBenchmark", () => {
  it("maps known workspace names to repo paths", () => {
    expect(phaseBWorkspaceRepoPath("STAX")).toBe("/Users/deanguedo/Documents/GitHub/STAX");
    expect(phaseBWorkspaceRepoPath("ADMISSION-APP")).toBe("/Users/deanguedo/Documents/GitHub/ADMISSION-APP");
    expect(phaseBWorkspaceRepoPath("canvas-helper")).toBe("/Users/deanguedo/Documents/GitHub/canvas-helper");
  });

  it("builds STAX-specific evidence for prior-run tasks without leaking admission proof surfaces", () => {
    const capture: PhaseBCaptureEntry = {
      taskId: "stateful_prior_run_001",
      workspace: "STAX",
      category: "prior_run_proof",
      prompt: "Given prior run artifacts, what is actually proven vs unproven right now, and what is one bounded next proof action?",
      staxOutput: "stub",
      chatgptOutput: "stub"
    };

    const evidence = buildPhaseBLocalEvidence(capture);
    expect(evidence).toContain("Target repo path: /Users/deanguedo/Documents/GitHub/STAX");
    expect(evidence).toContain("prior run traces available");
    expect(evidence).not.toContain("validate-sync-surface.ps1");
    expect(evidence).not.toContain("build:pages");
  });

  it("builds benchmark collections from stateful captures", () => {
    const collection = buildPhaseBBenchmarkCollection([
      {
        taskId: "stateful_cleanup_020",
        workspace: "ADMISSION-APP",
        category: "cleanup_after_codex",
        prompt: "Write one bounded next prompt that preserves publish/sync safety boundaries and requires preflight evidence.",
        staxOutput: "## Verdict\n- stub",
        chatgptOutput: "## Verdict\n- stub"
      }
    ]);

    expect(collection.id).toBe("phaseB-stateful-20");
    expect(collection.cases).toHaveLength(1);
    expect(collection.cases[0]?.repo).toBe("ADMISSION-APP");
    expect(collection.cases[0]?.localEvidence).toContain("validate-sync-surface.ps1");
    expect(collection.cases[0]?.externalAnswerSource).toBe("raw_chatgpt_browser");
  });
});
