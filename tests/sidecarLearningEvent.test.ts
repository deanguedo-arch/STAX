import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { SidecarLearningEventSchema, type SidecarLearningEvent } from "../src/sidecar/SidecarLearningEvent.js";
import { redactSidecarText } from "../src/sidecar/SidecarRedactor.js";
import { writeSidecarLearningEvent } from "../src/sidecar/SidecarLearningWriter.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

describe("STAX sidecar learning events", () => {
  it("validates schema and redacts or blocks sensitive content", () => {
    const parsed = SidecarLearningEventSchema.parse(baseEvent());
    const redacted = redactSidecarText("Authorization: Bearer abcdefghijklmnop");
    const blocked = redactSidecarText("API_KEY=supersecretvalue");

    expect(parsed.schemaVersion).toBe("sidecar-learning-v1");
    expect(redacted.status).toBe("redacted");
    expect(redacted.text).toContain("REDACTED");
    expect(blocked.status).toBe("blocked");
  });

  it("prevents privacy-blocked event writes", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-blocked-event-");
    await attachStaxToRepo(repoPath);
    const event = baseEvent({
      privacy: {
        redactionStatus: "blocked",
        redactionNotes: ["test"]
      }
    });

    const result = await writeSidecarLearningEvent(repoPath, event);

    expect(result.written).toBe(false);
    expect(await fs.readdir(path.join(repoPath, ".stax", "events"))).toHaveLength(0);
  });

  it("gate writes a fake-complete learning event locally", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-gate-event-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 2;\n", "utf8");
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      "Objective: change app\nFiles changed: src/app.ts\nTests added: none\nCommands run: npm test\nCommand output summary with exit codes: tests passed\nWhat is verified: done complete\nWhat is weak/provisional: none\nWhat is unverified: none\nRisks: none\nOne next action: accept\n",
      "utf8"
    );

    const status = await runStaxGate({ repoPath });
    const events = await fs.readdir(path.join(repoPath, ".stax", "events"));

    expect(status.verdict).toBe("Reject");
    expect(events.some((name) => name.endsWith(".json"))).toBe(true);
    const event = JSON.parse(await fs.readFile(path.join(repoPath, ".stax", "events", events[0]!), "utf8")) as SidecarLearningEvent;
    expect(["fake_complete_caught", "missing_proof_caught"]).toContain(event.eventType);
  });
});

function baseEvent(overrides: Partial<SidecarLearningEvent> = {}): SidecarLearningEvent {
  return {
    eventId: "evt_test",
    eventType: "missing_proof_caught",
    schemaVersion: "sidecar-learning-v1",
    createdAt: "2026-05-04T00:00:00.000Z",
    sourceRepo: {
      name: "repo",
      pathHash: "1234567890abcdef"
    },
    task: {
      taskId: "task_001",
      objective: "test",
      finalOutcome: "rejected_fake_complete"
    },
    stax: {
      verdict: "Reject",
      useful: true,
      falseAccept: false,
      falseBlock: false,
      usefulBlock: true,
      verifiedAccept: false
    },
    evidence: {
      changedFileRoles: ["docs"],
      commandProofStrengths: ["none"],
      claimTypes: ["implementation"],
      failurePatternIds: ["docs_only_implementation_claim"]
    },
    promotion: {
      suggested: true,
      target: "regression_eval",
      scope: "global",
      rationale: "General pattern."
    },
    privacy: {
      redactionStatus: "clean",
      redactionNotes: []
    },
    ...overrides
  };
}
