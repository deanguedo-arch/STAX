import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { LearningEvent, LearningQueueType } from "./LearningEvent.js";

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
    const queueCounts = await this.queueCounts();
    const totalQueueItems = Object.values(queueCounts).reduce((sum, count) => sum + count, 0);
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
    const queueCount = (type: LearningQueueType) => queueCounts[type] ?? 0;
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
      candidateApprovalRate: totalQueueItems + approved ? Number((approved / (totalQueueItems + approved)).toFixed(3)) : 0,
      candidateRejectionRate: totalQueueItems + rejected ? Number((rejected / (totalQueueItems + rejected)).toFixed(3)) : 0,
      modeFailureRate: Number((failed.length / total).toFixed(3)),
      planningSpecificityScore,
      byMode
    };
    await this.write(metrics);
    return metrics;
  }

  async read(): Promise<LearningMetrics> {
    try {
      const raw = await fs.readFile(path.join(this.rootDir, "learning", "metrics", "learning_metrics.json"), "utf8");
      return JSON.parse(raw) as LearningMetrics;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      return this.update();
    }
  }

  async updateForEvent(event: LearningEvent): Promise<LearningMetrics> {
    const cached = await this.readCached();
    if (!cached) return this.update();

    const previousTotal = cached.learningEventsCreated || 0;
    const nextTotal = previousTotal + 1;
    const hasFailure = event.failureClassification.hasFailure;
    const schemaFailure = !event.output.schemaValid || event.failureClassification.failureTypes.includes("schema_failure");
    const criticFailure = !event.output.criticPassed || event.failureClassification.failureTypes.includes("critic_failure");
    const genericFailure = event.failureClassification.failureTypes.includes("generic_output");
    const evalFailure = event.failureClassification.failureTypes.includes("eval_failure");
    const ratio = (previousRate: number, increment: boolean) =>
      Number((((previousRate * previousTotal) + (increment ? 1 : 0)) / nextTotal).toFixed(3));
    const passRatio = (previousRate: number, failed: boolean) =>
      Number((((previousRate * previousTotal) + (failed ? 0 : 1)) / nextTotal).toFixed(3));
    const byMode = { ...cached.byMode };
    const mode = event.output.mode;
    const modeStats = byMode[mode] ?? { runs: 0, failures: 0, corrections: 0, evalsAdded: 0, genericOutputRate: 0 };
    const previousModeRuns = modeStats.runs;
    const nextModeRuns = previousModeRuns + 1;
    byMode[mode] = {
      runs: nextModeRuns,
      failures: modeStats.failures + (hasFailure ? 1 : 0),
      corrections: modeStats.corrections + (event.proposedQueues.includes("correction_candidate") ? 1 : 0),
      evalsAdded: modeStats.evalsAdded + (event.proposedQueues.includes("eval_candidate") ? 1 : 0),
      genericOutputRate: Number((((modeStats.genericOutputRate * previousModeRuns) + (genericFailure ? 1 : 0)) / nextModeRuns).toFixed(3))
    };

    const metrics: LearningMetrics = {
      ...cached,
      learningEventsCreated: nextTotal,
      totalRuns: cached.totalRuns + (event.command ? 0 : 1),
      correctionCandidates: cached.correctionCandidates + (event.proposedQueues.includes("correction_candidate") ? 1 : 0),
      evalCandidates: cached.evalCandidates + (event.proposedQueues.includes("eval_candidate") ? 1 : 0),
      memoryCandidates: cached.memoryCandidates + (event.proposedQueues.includes("memory_candidate") ? 1 : 0),
      trainingCandidates: cached.trainingCandidates + (event.proposedQueues.includes("training_candidate") ? 1 : 0),
      policyPatchCandidates: cached.policyPatchCandidates + (event.proposedQueues.includes("policy_patch_candidate") ? 1 : 0),
      schemaPatchCandidates: cached.schemaPatchCandidates + (event.proposedQueues.includes("schema_patch_candidate") ? 1 : 0),
      modeContractPatchCandidates: cached.modeContractPatchCandidates + (event.proposedQueues.includes("mode_contract_patch_candidate") ? 1 : 0),
      codexPromptCandidates: cached.codexPromptCandidates + (event.proposedQueues.includes("codex_prompt_candidate") ? 1 : 0),
      schemaPassRate: passRatio(cached.schemaPassRate, schemaFailure),
      schemaFailureRate: ratio(cached.schemaFailureRate, schemaFailure),
      criticPassRate: passRatio(cached.criticPassRate, criticFailure),
      criticFailureRate: ratio(cached.criticFailureRate, criticFailure),
      repairRate: ratio(cached.repairRate, event.output.repairAttempted),
      genericOutputRate: ratio(cached.genericOutputRate, genericFailure),
      evalPassRate: passRatio(cached.evalPassRate, evalFailure),
      evalFailureRate: ratio(cached.evalFailureRate, evalFailure),
      modeFailureRate: ratio(cached.modeFailureRate, hasFailure),
      planningSpecificityScore: mode === "planning"
        ? Number(((cached.planningSpecificityScore * Math.max(0, previousModeRuns) + event.qualitySignals.specificityScore) / nextModeRuns).toFixed(3))
        : cached.planningSpecificityScore,
      byMode
    };
    await this.write(metrics);
    return metrics;
  }

  private async events(): Promise<LearningEvent[]> {
    const dir = path.join(this.rootDir, "learning", "events", "hot");
    try {
      const entries = (await fs.readdir(dir)).filter((entry) => entry.endsWith(".json"));
      return Promise.all(
        entries.map(async (entry) => JSON.parse(await fs.readFile(path.join(dir, entry), "utf8")) as LearningEvent)
      );
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

  private async queueCounts(): Promise<Record<LearningQueueType, number>> {
    const counts = {} as Record<LearningQueueType, number>;
    for (const [type, dir] of Object.entries(queueDirs) as Array<[LearningQueueType, string]>) {
      counts[type] = await this.countFiles(path.join(this.rootDir, "learning", "queue", dir));
    }
    return counts;
  }

  private async readCached(): Promise<LearningMetrics | undefined> {
    try {
      const raw = await fs.readFile(path.join(this.rootDir, "learning", "metrics", "learning_metrics.json"), "utf8");
      if (!raw.trim()) return undefined;
      return JSON.parse(raw) as LearningMetrics;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      if (error instanceof SyntaxError) return undefined;
      throw error;
    }
  }

  private async write(metrics: LearningMetrics): Promise<void> {
    const metricsDir = path.join(this.rootDir, "learning", "metrics");
    await fs.mkdir(metricsDir, { recursive: true });
    const target = path.join(metricsDir, "learning_metrics.json");
    const temp = path.join(metricsDir, `learning_metrics.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
    await fs.writeFile(temp, JSON.stringify(metrics, null, 2), "utf8");
    await fs.rename(temp, target);
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
