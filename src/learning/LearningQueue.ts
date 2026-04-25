import fs from "node:fs/promises";
import path from "node:path";
import type { LearningEvent, LearningQueueItem, LearningQueueType } from "./LearningEvent.js";
import { LearningQueueItemSchema } from "./LearningEvent.js";

const queueDirs: Record<LearningQueueType, string> = {
  trace_only: "trace_only",
  correction_candidate: "correction_candidates",
  eval_candidate: "eval_candidates",
  memory_candidate: "memory_candidates",
  training_candidate: "training_candidates",
  policy_patch_candidate: "policy_patch_candidates",
  schema_patch_candidate: "schema_patch_candidates",
  mode_contract_patch_candidate: "mode_contract_patch_candidates",
  codex_prompt_candidate: "codex_prompt_candidates"
};

export class LearningQueue {
  constructor(private rootDir = process.cwd()) {}

  async enqueue(event: LearningEvent): Promise<LearningQueueItem[]> {
    const items: LearningQueueItem[] = [];
    await this.ensureDirs();
    for (const queueType of event.proposedQueues) {
      const item: LearningQueueItem = {
        queueItemId: `${event.eventId}-${queueType}`,
        eventId: event.eventId,
        runId: event.runId,
        commandId: event.commandId,
        queueType,
        reason: this.reasonFor(event, queueType),
        sourceTracePath: event.links.tracePath,
        sourceFinalPath: event.links.finalPath,
        createdAt: new Date().toISOString(),
        approvalState: "pending_review"
      };
      LearningQueueItemSchema.parse(item);
      const file = path.join(this.queueDir(queueType), `${item.queueItemId}.json`);
      await fs.writeFile(file, JSON.stringify(item, null, 2), "utf8");
      items.push(item);
    }
    return items;
  }

  async list(type?: LearningQueueType): Promise<LearningQueueItem[]> {
    const dirs = type ? [this.queueDir(type)] : Object.keys(queueDirs).map((key) => this.queueDir(key as LearningQueueType));
    const items: LearningQueueItem[] = [];
    for (const dir of dirs) {
      try {
        for (const entry of await fs.readdir(dir)) {
          if (!entry.endsWith(".json")) continue;
          const raw = await fs.readFile(path.join(dir, entry), "utf8");
          items.push(LearningQueueItemSchema.parse(JSON.parse(raw)));
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async reject(eventId: string, reason: string): Promise<string[]> {
    if (!reason.trim()) throw new Error("Reject requires --reason.");
    const items = (await this.list()).filter((item) => item.eventId === eventId || item.queueItemId === eventId);
    if (items.length === 0) throw new Error(`Learning queue item not found: ${eventId}`);
    const rejectedDir = path.join(this.rootDir, "learning", "rejected");
    await fs.mkdir(rejectedDir, { recursive: true });
    const moved: string[] = [];
    for (const item of items) {
      const source = path.join(this.queueDir(item.queueType), `${item.queueItemId}.json`);
      const target = path.join(rejectedDir, `${item.queueItemId}.json`);
      await fs.writeFile(
        target,
        JSON.stringify({ ...item, approvalState: "rejected", rejectedAt: new Date().toISOString(), rejectionReason: reason }, null, 2),
        "utf8"
      );
      await fs.rm(source, { force: true });
      moved.push(target);
    }
    return moved;
  }

  queueDir(type: LearningQueueType): string {
    return path.join(this.rootDir, "learning", "queue", queueDirs[type]);
  }

  private async ensureDirs(): Promise<void> {
    await Promise.all(
      [
        "learning/events/hot",
        "learning/events/archive",
        "learning/approved",
        "learning/rejected",
        "learning/metrics",
        "learning/proposals",
        ...Object.values(queueDirs).map((dir) => path.join("learning", "queue", dir))
      ].map((dir) => fs.mkdir(path.join(this.rootDir, dir), { recursive: true }))
    );
  }

  private reasonFor(event: LearningEvent, queueType: LearningQueueType): string {
    if (queueType === "trace_only") return "Run recorded for trace-only learning evidence.";
    const failures = event.failureClassification.failureTypes.join(", ") || event.output.finalStatus;
    return `${queueType} created from ${failures}: ${event.failureClassification.explanation}`;
  }
}
