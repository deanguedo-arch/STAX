import fs from "node:fs/promises";
import path from "node:path";
import { MemoryStore } from "../memory/MemoryStore.js";
import type { MemoryType } from "../memory/memoryTypes.js";
import { LearningEventSchema } from "./LearningEvent.js";

export type PromotionTarget =
  | "correction"
  | "eval"
  | "memory"
  | "training"
  | "policy_patch"
  | "schema_patch"
  | "mode_contract_patch"
  | "golden";

export type PromotionInput = {
  eventId: string;
  target: PromotionTarget;
  reason: string;
  approvedBy?: string;
  approveMemory?: boolean;
  manual?: boolean;
};

export type PromotionRecord = {
  promotionId: string;
  approvedBy: string;
  approvedAt: string;
  approvalReason: string;
  sourceEventId: string;
  sourceRunId: string;
  promotionTarget: PromotionTarget;
  targetArtifactPath: string;
};

export class PromotionGate {
  constructor(private rootDir = process.cwd()) {}

  async promote(input: PromotionInput): Promise<PromotionRecord> {
    if (!input.reason.trim()) throw new Error("Promotion requires --reason.");
    const event = await this.readEvent(input.eventId);
    if (!event && !input.manual) {
      throw new Error("Promotion requires source event/run unless explicitly marked manual.");
    }
    const sourceEventId = event?.eventId ?? input.eventId;
    const sourceRunId = event?.runId ?? "manual";
    const approvedAt = new Date().toISOString();
    const promotionId = `${sourceEventId}-${input.target}`;
    const targetArtifactPath = await this.writeTarget(input.target, sourceEventId, sourceRunId, input.reason, input.approveMemory);
    const record: PromotionRecord = {
      promotionId,
      approvedBy: input.approvedBy ?? "cli",
      approvedAt,
      approvalReason: input.reason,
      sourceEventId,
      sourceRunId,
      promotionTarget: input.target,
      targetArtifactPath
    };
    const approvedDir = path.join(this.rootDir, "learning", "approved");
    await fs.mkdir(approvedDir, { recursive: true });
    await fs.writeFile(path.join(approvedDir, `${promotionId}.json`), JSON.stringify(record, null, 2), "utf8");
    return record;
  }

  private async readEvent(eventId: string) {
    const candidate = path.join(this.rootDir, "learning", "events", "hot", `${eventId}.json`);
    try {
      return LearningEventSchema.parse(JSON.parse(await fs.readFile(candidate, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return undefined;
    }
  }

  private async writeTarget(
    target: PromotionTarget,
    eventId: string,
    runId: string,
    reason: string,
    approveMemory = false
  ): Promise<string> {
    if (target === "memory") {
      const record = await new MemoryStore(this.rootDir).add({
        type: "project" as MemoryType,
        content: `Learning promotion candidate from ${eventId}: ${reason}`,
        sourceRunId: runId,
        approved: approveMemory,
        confidence: "medium",
        tags: ["learning", "promotion"]
      });
      return path.join(this.rootDir, "memory", record.type, "memory.json");
    }
    if (target === "eval") {
      const dir = path.join(this.rootDir, "evals", "regression");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${eventId}.json`);
      await fs.writeFile(
        file,
        JSON.stringify(
          {
            id: eventId,
            mode: "learning_unit",
            input: `Review learning event ${eventId}.`,
            expectedProperties: ["approval_required", "candidate_queues"],
            forbiddenPatterns: ["autonomous self-learning", "auto-promote"],
            requiredSections: ["## Candidate Queues", "## Approval Required"],
            critical: false,
            tags: ["learning", "approved-promotion"],
            sourceRunId: runId
          },
          null,
          2
        ),
        "utf8"
      );
      return file;
    }
    if (target === "correction") {
      const dir = path.join(this.rootDir, "corrections", "pending");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${eventId}.json`);
      await fs.writeFile(
        file,
        JSON.stringify(
          {
            correctionId: eventId,
            runId,
            createdAt: new Date().toISOString(),
            originalOutput: `Source event ${eventId}`,
            correctedOutput: "Pending user-supplied correction required before training promotion.",
            reason,
            errorType: "weak_plan",
            tags: ["learning"],
            approved: false,
            promoteToEval: false,
            promoteToTraining: false
          },
          null,
          2
        ),
        "utf8"
      );
      return file;
    }
    const folderByTarget: Record<Exclude<PromotionTarget, "memory" | "eval" | "correction">, string> = {
      training: "training/candidates",
      policy_patch: "learning/proposals/policy_patch_candidates",
      schema_patch: "learning/proposals/schema_patch_candidates",
      mode_contract_patch: "learning/proposals/mode_contract_patch_candidates",
      golden: "goldens"
    };
    const dir = path.join(this.rootDir, folderByTarget[target]);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, target === "golden" ? `${eventId}.md` : `${eventId}.json`);
    const content =
      target === "golden"
        ? `Golden candidate for ${eventId}\n\nApproval reason: ${reason}\n`
        : JSON.stringify({ eventId, runId, reason, target, approvalRequired: true }, null, 2);
    await fs.writeFile(file, content, "utf8");
    return file;
  }
}

