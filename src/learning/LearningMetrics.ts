import fs from "node:fs/promises";
import path from "node:path";
import type { LearningEvent, LearningQueueType } from "./LearningEvent.js";
import { LearningEventSchema } from "./LearningEvent.js";
import { LearningQueue } from "./LearningQueue.js";

export type LearningMetrics = {
  totalRuns: number;
  learningEventsCreated: number;
  correctionCandidates: number;
  evalCandidates: number;
  memoryCandidates: number;
  trainingCandidates: number;
  policyPatchCandidates: number;
  schemaPatchCandidates: number;
  modeContractPatchCandidates: number;
  codexPromptCandidates: number;
  approvedCorrections: number;
  approvedEvals: number;
  approvedMemories: number;
  approvedTrainingRecords: number;
  schemaPassRate: number;
  schemaFailureRate: number;
  criticPassRate: number;
  criticFailureRate: number;
  repairRate: number;
  genericOutputRate: number;
  evalPassRate: number;
  evalFailureRate: number;
  repeatFailureRate: number;
  candidateApprovalRate: number;
  candidateRejectionRate: number;
  modeFailureRate: number;
  planningSpecificityScore: number;
  byMode: Record<string, {
    runs: number;
    failures: number;
    corrections: number;
    evalsAdded: number;
    genericOutputRate: number;
  }>;
};

export class LearningMetricsStore {
  constructor(private rootDir = process.cwd()) {}

  async update(): Promise<LearningMetrics> {
    const events = await this.events();
    const queueItems = await new LearningQueue(this.rootDir).list();
    const approved = await this.countFiles(path.join(this.rootDir, "learning", "approved"));
    const rejected = await this.countFiles(path.join(this.rootDir, "learning", "rejected"));
    const total = events.length || 1;
    const failed = events.filter((event) => event.failureClassification.hasFailure);
    const schemaFailed = events.filter((event) => !event.output.schemaValid || event.failureClassification.failureTypes.includes("schema_failure")).length;
    const criticFailed = events.filter((event) => !event.output.criticPassed || event.failureClassification.failureTypes.includes("critic_failure")).length;
    const genericFailed = events.filter((event) => event.failureClassification.failureTypes.includes("generic_output")).length;
    const evalFailed = events.filter((event) => event.failureClassification.failureTypes.includes("eval_failure")).length;
    const byMode: LearningMetrics["byMode"] = {};
    for (const event of events) {
      const mode = event.output.mode;
      byMode[mode] ??= { runs: 0, failures: 0, corrections: 0, evalsAdded: 0, genericOutputRate: 0 };
      byMode[mode].runs += 1;
      if (event.failureClassification.hasFailure) byMode[mode].failures += 1;
      if (event.proposedQueues.includes("correction_candidate")) byMode[mode].corrections += 1;
      if (event.proposedQueues.includes("eval_candidate")) byMode[mode].evalsAdded += 1;
    }
    for (const [mode, stats] of Object.entries(byMode)) {
      const generic = events.filter(
        (event) => event.output.mode === mode && event.failureClassification.failureTypes.includes("generic_output")
      ).length;
      stats.genericOutputRate = stats.runs ? Number((generic / stats.runs).toFixed(3)) : 0;
    }
    const queueCount = (type: LearningQueueType) => queueItems.filter((item) => item.queueType === type).length;
    const planningEvents = events.filter((event) => event.output.mode === "planning");
    const planningSpecificityScore = planningEvents.length
      ? Number((planningEvents.reduce((sum, event) => sum + event.qualitySignals.specificityScore, 0) / planningEvents.length).toFixed(3))
      : 1;
    const metrics: LearningMetrics = {
      totalRuns: events.filter((event) => !event.command).length,
      learningEventsCreated: events.length,
      correctionCandidates: queueCount("correction_candidate"),
      evalCandidates: queueCount("eval_candidate"),
      memoryCandidates: queueCount("memory_candidate"),
      trainingCandidates: queueCount("training_candidate"),
      policyPatchCandidates: queueCount("policy_patch_candidate"),
      schemaPatchCandidates: queueCount("schema_patch_candidate"),
      modeContractPatchCandidates: queueCount("mode_contract_patch_candidate"),
      codexPromptCandidates: queueCount("codex_prompt_candidate"),
      approvedCorrections: approved,
      approvedEvals: approved,
      approvedMemories: approved,
      approvedTrainingRecords: approved,
      schemaPassRate: Number(((total - schemaFailed) / total).toFixed(3)),
      schemaFailureRate: Number((schemaFailed / total).toFixed(3)),
      criticPassRate: Number(((total - criticFailed) / total).toFixed(3)),
      criticFailureRate: Number((criticFailed / total).toFixed(3)),
      repairRate: Number((events.filter((event) => event.output.repairAttempted).length / total).toFixed(3)),
      genericOutputRate: Number((genericFailed / total).toFixed(3)),
      evalPassRate: Number(((total - evalFailed) / total).toFixed(3)),
      evalFailureRate: Number((evalFailed / total).toFixed(3)),
      repeatFailureRate: Number((this.repeatFailureCount(events) / total).toFixed(3)),
      candidateApprovalRate: queueItems.length + approved ? Number((approved / (queueItems.length + approved)).toFixed(3)) : 0,
      candidateRejectionRate: queueItems.length + rejected ? Number((rejected / (queueItems.length + rejected)).toFixed(3)) : 0,
      modeFailureRate: Number((failed.length / total).toFixed(3)),
      planningSpecificityScore,
      byMode
    };
    const metricsDir = path.join(this.rootDir, "learning", "metrics");
    await fs.mkdir(metricsDir, { recursive: true });
    await fs.writeFile(path.join(metricsDir, "learning_metrics.json"), JSON.stringify(metrics, null, 2), "utf8");
    return metrics;
  }

  async read(): Promise<LearningMetrics> {
    try {
      const raw = await fs.readFile(path.join(this.rootDir, "learning", "metrics", "learning_metrics.json"), "utf8");
      return JSON.parse(raw) as LearningMetrics;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return this.update();
    }
  }

  private async events(): Promise<LearningEvent[]> {
    const dir = path.join(this.rootDir, "learning", "events", "hot");
    try {
      const events: LearningEvent[] = [];
      for (const entry of await fs.readdir(dir)) {
        if (!entry.endsWith(".json")) continue;
        const raw = await fs.readFile(path.join(dir, entry), "utf8");
        events.push(LearningEventSchema.parse(JSON.parse(raw)));
      }
      return events;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async countFiles(dir: string): Promise<number> {
    try {
      return (await fs.readdir(dir)).filter((entry) => entry.endsWith(".json") || entry.endsWith(".md")).length;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
  }

  private repeatFailureCount(events: LearningEvent[]): number {
    const seen = new Map<string, number>();
    for (const event of events) {
      for (const failure of event.failureClassification.failureTypes) {
        const key = `${event.output.mode}:${failure}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    return Array.from(seen.values()).filter((count) => count > 1).length;
  }
}

