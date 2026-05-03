import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeLiveCodexLoopTask,
  recordLiveCodexLoopTurn
} from "../src/campaign/LiveCodexLoopRunner.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("live Codex loop runner", () => {
  it("initializes a closed-loop task from a structured packet", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-live-loop-"));
    tempDirs.push(dir);
    const ledgerPath = path.join(dir, "ledger.json");

    const result = await initializeLiveCodexLoopTask({
      ledgerPath,
      taskId: "live_001",
      repo: "STAX",
      objective: "Audit whether a STAX implementation slice is proven.",
      packet: {
        task: "Audit whether this implementation fix is proven.",
        repo: "STAX",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        changedFiles: [],
        commandEvidence: [],
        codexReport: "",
        visualEvidence: [],
        dataProofArtifacts: [],
        releaseProofArtifacts: [],
        humanApproval: []
      }
    });

    expect(result.task.state).toBe("prompt_generated");
    expect(result.task.stateHistory.map((item) => item.state)).toEqual(["created", "scoped", "prompt_generated"]);
    expect(result.task.staxCodexPrompt.length).toBeGreaterThan(20);
  });

  it("records a Codex turn and computes a verified-next-state outcome", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-live-loop-"));
    tempDirs.push(dir);
    const ledgerPath = path.join(dir, "ledger.json");

    await initializeLiveCodexLoopTask({
      ledgerPath,
      taskId: "live_002",
      repo: "STAX",
      objective: "Audit whether a STAX implementation slice is proven.",
      packet: {
        task: "Audit whether this implementation fix is proven.",
        repo: "STAX",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        changedFiles: [],
        commandEvidence: [],
        codexReport: "",
        visualEvidence: [],
        dataProofArtifacts: [],
        releaseProofArtifacts: [],
        humanApproval: []
      }
    });

    const result = await recordLiveCodexLoopTurn({
      ledgerPath,
      taskId: "live_002",
      codexReport: [
        "Files changed: src/agents/AnalystAgent.ts, tests/projectControlMode.test.ts",
        "Commands run: npm test (exit code 0)",
        "What is verified: tests passed locally",
        "What is unverified: broader behavior outside this slice",
        "Risks: broader runtime behavior not checked"
      ].join("\n"),
      diffEvidence: "Changed files: src/agents/AnalystAgent.ts\ntests/projectControlMode.test.ts",
      commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\n$ npm test\nExit code: 0"
    });

    expect(result.task.stateHistory.map((item) => item.state)).toContain("codex_report_received");
    expect(result.task.stateHistory.map((item) => item.state)).toContain("diff_collected");
    expect(result.task.stateHistory.map((item) => item.state)).toContain("command_evidence_collected");
    expect(result.task.stateHistory.map((item) => item.state)).toContain("audited");
    expect(["verified_next_state", "verified_complete"]).toContain(result.task.finalOutcome);
  });

  it("routes fake-complete one-liners into rejected fake-complete state", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-live-loop-"));
    tempDirs.push(dir);
    const ledgerPath = path.join(dir, "ledger.json");

    await initializeLiveCodexLoopTask({
      ledgerPath,
      taskId: "live_003",
      repo: "STAX",
      objective: "Audit whether a STAX implementation slice is proven.",
      packet: {
        task: "Audit whether this implementation fix is proven.",
        repo: "STAX",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        changedFiles: [],
        commandEvidence: [],
        codexReport: "",
        visualEvidence: [],
        dataProofArtifacts: [],
        releaseProofArtifacts: [],
        humanApproval: []
      }
    });

    const result = await recordLiveCodexLoopTurn({
      ledgerPath,
      taskId: "live_003",
      codexReport: "I fixed it and tests passed.",
      diffEvidence: "",
      commandEvidence: ""
    });

    expect(result.task.finalOutcome).toBe("rejected_fake_complete");
    expect(result.task.state).toBe("rejected_fake_complete");
    expect(result.task.evalCandidate).toBe(true);
    expect(result.task.failurePatterns).toContain("A1_CLAIMED_COMMAND_PASSED_NO_EVIDENCE");
  });
});
