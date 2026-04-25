import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LearningMetricsStore } from "../src/learning/LearningMetrics.js";
import { LearningQueue } from "../src/learning/LearningQueue.js";
import { LearningRecorder } from "../src/learning/LearningRecorder.js";
import { LearningRetention } from "../src/learning/LearningRetention.js";
import { PromotionGate } from "../src/learning/PromotionGate.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-learning-runtime-"));
}

describe("learning runtime integration", () => {
  it("writes a learning event and trace link for normal runs", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });

    const output = await runtime.run("Build a STAX system improvement plan.", [], { mode: "planning" });
    const runDir = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId);
    const event = JSON.parse(await fs.readFile(path.join(runDir, "learning_event.json"), "utf8")) as {
      eventId: string;
      proposedQueues: string[];
    };
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      learningEventId: string;
      learningQueues: string[];
    };

    expect(event.eventId).toBeTruthy();
    expect(trace.learningEventId).toBe(event.eventId);
    expect(trace.learningQueues).toEqual(event.proposedQueues);
    await expect(fs.stat(path.join(rootDir, "learning", "events", "hot", `${event.eventId}.json`))).resolves.toBeTruthy();
  });

  it("records command events idempotently and updates metrics", async () => {
    const rootDir = await tempRoot();
    const recorder = new LearningRecorder(rootDir);
    const first = await recorder.recordCommand({
      commandName: "eval",
      argsSummary: "eval --regression",
      success: false,
      outputSummary: "critical failure",
      exitStatus: 1
    });
    const second = await recorder.recordCommand({
      commandName: "eval",
      argsSummary: "eval --regression",
      success: false,
      outputSummary: "critical failure",
      exitStatus: 1
    });
    const metrics = await new LearningMetricsStore(rootDir).read();

    expect(second.eventId).toBe(first.eventId);
    expect(first.commandId).toBeTruthy();
    expect(first.commands.commandName).toBe("eval");
    expect(first.commands.exitCode).toBe(1);
    expect(first.output.finalStatus).toBe("eval_failure");
    expect(metrics.learningEventsCreated).toBe(1);
    expect(metrics.evalCandidates).toBeGreaterThan(0);
  });

  it("routes replay drift and promotion failures into governed queues", async () => {
    const rootDir = await tempRoot();
    const recorder = new LearningRecorder(rootDir);
    const replay = await recorder.recordCommand({
      commandName: "replay",
      argsSummary: "replay run-1",
      success: false,
      outputSummary: "Replay drift detected",
      exitStatus: 1
    });
    const promotion = await recorder.recordCommand({
      commandName: "learn promote",
      argsSummary: "learn promote learn-run-1 --eval",
      success: false,
      outputSummary: "Promotion requires --reason.",
      exitStatus: 1
    });

    expect(replay.output.finalStatus).toBe("replay_failure");
    expect(replay.failureClassification.failureTypes).toContain("replay_drift");
    expect(replay.proposedQueues).toEqual(expect.arrayContaining(["eval_candidate", "policy_patch_candidate"]));
    expect(promotion.output.finalStatus).toBe("promotion_failure");
    expect(promotion.failureClassification.failureTypes).toContain("promotion_failure");
    expect(promotion.proposedQueues).toEqual(expect.arrayContaining(["correction_candidate", "eval_candidate"]));
  });

  it("requires promotion reasons and keeps memory pending by default", async () => {
    const rootDir = await tempRoot();
    const event = await new LearningRecorder(rootDir).recordCommand({
      commandName: "learn propose",
      argsSummary: "learn propose run-1",
      success: false,
      outputSummary: "weak proposal",
      exitStatus: 1
    });
    const gate = new PromotionGate(rootDir);

    await expect(gate.promote({ eventId: event.eventId, target: "memory", reason: "" })).rejects.toThrow(/reason/);
    const promoted = await gate.promote({ eventId: event.eventId, target: "memory", reason: "approved candidate review" });
    const memoryRaw = await fs.readFile(promoted.targetArtifactPath, "utf8");

    expect(promoted.approvalReason).toBe("approved candidate review");
    expect(memoryRaw).toContain('"approved": false');
  });

  it("queues weak planning output as eval, mode, and Codex prompt candidates", async () => {
    const rootDir = await tempRoot();
    const recorder = new LearningRecorder(rootDir);
    const event = await recorder.recordCommand({
      commandName: "run",
      argsSummary: "generic weak planning output",
      success: false,
      outputSummary: "Confirm requirements and break into steps.",
      exitStatus: 1,
      mode: "planning"
    });
    const items = await new LearningQueue(rootDir).list();

    expect(event.failureClassification.failureTypes).toContain("command_failure");
    expect(items.map((item) => item.queueType)).toEqual(expect.arrayContaining(["eval_candidate", "policy_patch_candidate"]));
  });

  it("retention dry-run preserves runs linked to durable artifacts", async () => {
    const rootDir = await tempRoot();
    const runId = "run-linked";
    const runDir = path.join(rootDir, "runs", "2026-01-01", runId);
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "trace.json"), JSON.stringify({ learningQueues: ["trace_only"] }), "utf8");
    await fs.writeFile(path.join(runDir, "final.md"), "ok", "utf8");
    const oldDate = new Date("2026-01-01T00:00:00.000Z");
    await fs.utimes(runDir, oldDate, oldDate);

    const approvedDir = path.join(rootDir, "learning", "approved");
    await fs.mkdir(approvedDir, { recursive: true });
    await fs.writeFile(path.join(approvedDir, "approval.json"), JSON.stringify({ sourceRunId: runId }), "utf8");

    const result = await new LearningRetention(rootDir).run({ hotRetentionDays: 0 });

    expect(result.selectedRuns).not.toContain(runDir);
    expect(result.skippedRuns).toEqual(
      expect.arrayContaining([expect.objectContaining({ runPath: runDir, reason: "linked durable artifact in learning/approved" })])
    );
  });
});
