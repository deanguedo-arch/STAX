import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LearningMetricsStore } from "../src/learning/LearningMetrics.js";
import { LearningQueue } from "../src/learning/LearningQueue.js";
import { LearningRecorder } from "../src/learning/LearningRecorder.js";
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
    expect(metrics.learningEventsCreated).toBe(1);
    expect(metrics.evalCandidates).toBeGreaterThan(0);
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
});
