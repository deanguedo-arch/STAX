import fs from "node:fs/promises";
import path from "node:path";
import { LearningRecorder } from "../learning/LearningRecorder.js";
import { ReviewLedger } from "./ReviewLedger.js";
import { ReviewQueue } from "./ReviewQueue.js";
import { ReviewRiskScorer } from "./ReviewRiskScorer.js";
import { ReviewSourceSchema, type ReviewRecord, type ReviewSource } from "./ReviewSchemas.js";

export type ReviewRouteOptions = {
  apply?: boolean;
};

export class ReviewRouter {
  private scorer: ReviewRiskScorer;
  private ledger: ReviewLedger;
  private queue: ReviewQueue;

  constructor(private rootDir = process.cwd()) {
    this.scorer = new ReviewRiskScorer();
    this.ledger = new ReviewLedger(rootDir);
    this.queue = new ReviewQueue(rootDir);
  }

  async route(input: ReviewSource, options: ReviewRouteOptions = {}): Promise<{ source: ReviewSource; record: ReviewRecord; applied: boolean; created: boolean }> {
    const source = ReviewSourceSchema.parse(input);
    const triage = this.scorer.score(source);
    const sourceHash = this.ledger.sourceHash(source);
    const now = new Date().toISOString();
    const preview = {
      reviewId: `rev-${sourceHash.slice(0, 16)}`,
      sourceId: source.sourceId,
      sourceHash,
      sourceType: source.sourceType,
      sourcePath: source.sourcePath,
      workspace: source.workspace,
      riskScore: triage.riskScore,
      riskLevel: triage.riskLevel,
      confidence: triage.confidence,
      disposition: triage.disposition,
      reasonCodes: triage.reasonCodes,
      evidencePaths: triage.evidencePaths,
      routerVersion: "v1" as const,
      state: "active" as const,
      requiresPromotionGate: true as const,
      allowedActions: triage.allowedActions,
      supersedesReviewIds: [],
      createdAt: now,
      updatedAt: now
    };
    if (!options.apply) {
      return { source, record: preview, applied: false, created: false };
    }
    const { record, created } = await this.ledger.record(source, triage);
    await this.queue.write(record);
    if (created && record.supersedesReviewIds.length > 0) {
      for (const oldReviewId of record.supersedesReviewIds) {
        const stale = await this.ledger.transition(
          oldReviewId,
          "stale",
          `Source hash changed; superseded by ${record.reviewId}.`
        );
        await this.queue.write(stale);
      }
    }
    if (record.disposition === "hard_block") {
      await new LearningRecorder(this.rootDir).recordCommand({
        commandName: "review hard_block",
        argsSummary: `${source.sourceType}:${source.sourceId}`,
        success: false,
        outputSummary: record.reasonCodes.join(", "),
        exitStatus: 1,
        artifactPaths: [record.sourcePath, ...record.evidencePaths].filter(Boolean) as string[],
        workspace: record.workspace
      });
    }
    return { source, record, applied: true, created };
  }

  async routeSourceId(sourceId: string, options: ReviewRouteOptions = {}): Promise<{ source: ReviewSource; record: ReviewRecord; applied: boolean; created: boolean }> {
    const source = await this.resolveSource(sourceId);
    return this.route(source, options);
  }

  async refresh(options: ReviewRouteOptions = { apply: true }): Promise<ReviewRecord[]> {
    const records: ReviewRecord[] = [];
    for (const source of await this.discoverSources()) {
      records.push((await this.route(source, options)).record);
    }
    return records;
  }

  async discoverSources(): Promise<ReviewSource[]> {
    const dirs = [
      "learning/queue/correction_candidates",
      "learning/queue/eval_candidates",
      "learning/queue/memory_candidates",
      "learning/queue/training_candidates",
      "learning/queue/policy_patch_candidates",
      "learning/queue/schema_patch_candidates",
      "learning/queue/mode_contract_patch_candidates",
      "learning/queue/codex_prompt_candidates",
      "learning/lab/candidates",
      "learning/lab/patches",
      "learning/lab/handoffs",
      "learning/eval_pairs",
      "corrections/pending"
    ];
    const sources: ReviewSource[] = [];
    for (const dir of dirs) {
      for (const file of await this.walk(path.join(this.rootDir, dir))) {
        if (!/\.(json|md|markdown)$/i.test(file)) continue;
        try {
          sources.push(await this.sourceFromPath(file));
        } catch {
          // Ignore malformed generated artifacts; they can be inspected directly.
        }
      }
    }
    return sources;
  }

  private async resolveSource(sourceId: string): Promise<ReviewSource> {
    const directPath = path.isAbsolute(sourceId) ? sourceId : path.join(this.rootDir, sourceId);
    if (this.insideRoot(directPath)) {
      try {
        const stat = await fs.stat(directPath);
        if (stat.isFile()) return this.sourceFromPath(directPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const matches = (await this.discoverSources()).filter((source) =>
      source.sourceId === sourceId ||
      source.sourceId.includes(sourceId) ||
      source.sourcePath === sourceId ||
      source.sourcePath?.endsWith(sourceId)
    );
    if (matches.length === 0) throw new Error(`Review source not found: ${sourceId}`);
    if (matches.length > 1) {
      const exact = matches.find((source) => source.sourceId === sourceId);
      if (exact) return exact;
    }
    return matches[0] as ReviewSource;
  }

  private async sourceFromPath(file: string): Promise<ReviewSource> {
    if (!this.insideRoot(file)) throw new Error(`Review source path must stay inside repo: ${file}`);
    const relative = path.relative(this.rootDir, file);
    const content = await fs.readFile(file, "utf8");
    const parsed = this.parseJson(content);
    const sourceId = this.sourceId(parsed, relative);
    const sourceType = this.sourceType(relative, parsed);
    const source = ReviewSourceSchema.parse({
      sourceId,
      sourceType,
      sourcePath: relative,
      content,
      workspace: this.stringValue(parsed, "workspace"),
      synthetic: this.booleanValue(parsed, "synthetic"),
      approvalState: this.stringValue(parsed, "approvalState"),
      mode: this.stringValue(parsed, "mode") ?? this.stringValue(parsed, "targetMode"),
      targetArtifactType: this.targetArtifactType(parsed, relative),
      targetPaths: this.targetPaths(parsed, relative),
      failureTypes: this.stringArray(parsed, "failureTypes"),
      riskTags: this.riskTags(parsed),
      evidencePaths: this.evidencePaths(parsed, relative),
      reason: this.stringValue(parsed, "reason") ?? this.stringValue(parsed, "title"),
      repeatedCount: 0,
      createdAt: this.stringValue(parsed, "createdAt")
    });
    return source;
  }

  private sourceId(parsed: unknown, relative: string): string {
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["eventId", "queueItemId", "candidateId", "patchId", "handoffId", "commandEvidenceId", "correctionId", "id", "scenarioId"]) {
        if (typeof obj[key] === "string") return obj[key] as string;
      }
    }
    return path.basename(relative).replace(/\.(json|md|markdown)$/i, "");
  }

  private sourceType(relative: string, parsed: unknown): ReviewSource["sourceType"] {
    if (relative.startsWith("learning/events/")) return "learning_event";
    if (relative.startsWith("learning/queue/")) return "learning_queue_item";
    if (relative.startsWith("learning/lab/candidates/")) return "lab_candidate";
    if (relative.startsWith("learning/lab/patches/")) return "patch_proposal";
    if (relative.startsWith("learning/lab/handoffs/")) return "codex_handoff";
    if (relative.startsWith("learning/eval_pairs/")) return "eval_pair";
    if (relative.startsWith("corrections/")) return "correction";
    if (relative.startsWith("evidence/commands/")) return "command_event";
    if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).queueType === "eval_candidate") return "eval_candidate";
    return "unknown";
  }

  private targetArtifactType(parsed: unknown, relative: string): string | undefined {
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.candidateType === "string") return obj.candidateType;
      if (typeof obj.queueType === "string") return obj.queueType;
      if (typeof obj.promotionTarget === "string") return obj.promotionTarget;
    }
    if (relative.includes("/training/")) return "training";
    if (relative.includes("/memory/")) return "memory";
    return undefined;
  }

  private targetPaths(parsed: unknown, relative: string): string[] {
    const paths = new Set<string>([relative]);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["targetArtifactPath", "path", "markdownPath", "sourceTracePath", "sourceFinalPath"]) {
        if (typeof obj[key] === "string") paths.add(obj[key] as string);
      }
      for (const key of ["filesToModify", "filesToInspect", "artifactPaths", "requiredCommands"]) {
        if (Array.isArray(obj[key])) {
          for (const value of obj[key]) if (typeof value === "string") paths.add(value);
        }
      }
    }
    return Array.from(paths);
  }

  private evidencePaths(parsed: unknown, relative: string): string[] {
    const paths = new Set<string>();
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["evidencePaths", "artifactPaths", "queuesCreated"]) {
        if (Array.isArray(obj[key])) {
          for (const value of obj[key]) if (typeof value === "string") paths.add(value);
        }
      }
      for (const key of ["sourceTracePath", "sourceFinalPath", "tracePath", "finalPath"]) {
        if (typeof obj[key] === "string") paths.add(obj[key] as string);
      }
    }
    if (relative.startsWith("learning/events/")) paths.add(relative);
    return Array.from(paths);
  }

  private riskTags(parsed: unknown): string[] {
    const tags = new Set<string>();
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["riskTags", "reasonCodes", "failureTypes", "proposedQueues"]) {
        if (Array.isArray(obj[key])) {
          for (const value of obj[key]) if (typeof value === "string") tags.add(value);
        }
      }
      if (obj.approvalState === "trace_only") tags.add("trace_only");
    }
    return Array.from(tags);
  }

  private stringValue(parsed: unknown, key: string): string | undefined {
    return parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>)[key] === "string"
      ? (parsed as Record<string, string>)[key]
      : undefined;
  }

  private booleanValue(parsed: unknown, key: string): boolean | undefined {
    return parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>)[key] === "boolean"
      ? (parsed as Record<string, boolean>)[key]
      : undefined;
  }

  private stringArray(parsed: unknown, key: string): string[] {
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>)[key])) return [];
    return ((parsed as Record<string, unknown[]>)[key] ?? []).filter((value): value is string => typeof value === "string");
  }

  private parseJson(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  private async walk(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...await this.walk(full));
        if (entry.isFile()) files.push(full);
      }
      return files;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private insideRoot(file: string): boolean {
    const relative = path.relative(this.rootDir, file);
    return Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  }
}
