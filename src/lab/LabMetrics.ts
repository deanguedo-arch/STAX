import fs from "node:fs/promises";
import path from "node:path";
import {
  LabCandidateSchema,
  LabRunRecordSchema,
  LabScenarioSetSchema,
  ensureLabDirs,
  type LabCandidate,
  type LabRunRecord,
  type LabScenarioSet
} from "./LearningWorker.js";

export type LabMetricsReport = {
  scenariosGenerated: number;
  scenariosRun: number;
  passRate: number;
  failureTypes: Record<string, number>;
  candidatesCreated: number;
  approvalRate: number;
  repeatedFailures: number;
  byMode: Record<string, { scenariosRun: number; passed: number; failed: number }>;
  byDomain: Record<string, { scenariosRun: number; passed: number; failed: number }>;
  redteamPassRate: number;
};

export class LabMetrics {
  constructor(private rootDir = process.cwd()) {}

  async report(): Promise<LabMetricsReport> {
    await ensureLabDirs(this.rootDir);
    const scenarioSets = await this.scenarioSets();
    const runs = await this.runs();
    const candidates = await this.candidates();
    const results = runs.flatMap((run) => run.results);
    const scenariosRun = results.length;
    const passed = results.filter((result) => result.pass).length;
    const failureTypes: Record<string, number> = {};
    const byMode: LabMetricsReport["byMode"] = {};
    const byDomain: LabMetricsReport["byDomain"] = {};
    for (const result of results) {
      byMode[result.mode] ??= { scenariosRun: 0, passed: 0, failed: 0 };
      byDomain[result.domain] ??= { scenariosRun: 0, passed: 0, failed: 0 };
      byMode[result.mode].scenariosRun += 1;
      byDomain[result.domain].scenariosRun += 1;
      if (result.pass) {
        byMode[result.mode].passed += 1;
        byDomain[result.domain].passed += 1;
      } else {
        byMode[result.mode].failed += 1;
        byDomain[result.domain].failed += 1;
      }
      for (const reason of result.failReasons) {
        const key = reason.split(":")[0]?.trim() || reason;
        failureTypes[key] = (failureTypes[key] ?? 0) + 1;
      }
    }
    const redteam = results.filter((result) => result.domain === "redteam_governance");
    const report: LabMetricsReport = {
      scenariosGenerated: scenarioSets.reduce((sum, set) => sum + set.scenarios.length, 0),
      scenariosRun,
      passRate: scenariosRun ? Number((passed / scenariosRun).toFixed(3)) : 0,
      failureTypes,
      candidatesCreated: candidates.length,
      approvalRate: 0,
      repeatedFailures: Object.values(failureTypes).filter((count) => count > 1).length,
      byMode,
      byDomain,
      redteamPassRate: redteam.length
        ? Number((redteam.filter((result) => result.pass).length / redteam.length).toFixed(3))
        : 0
    };
    const reportDir = path.join(this.rootDir, "learning", "lab", "reports");
    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(path.join(reportDir, "latest.json"), JSON.stringify(report, null, 2), "utf8");
    return report;
  }

  async readLatest(): Promise<LabMetricsReport> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.rootDir, "learning", "lab", "reports", "latest.json"), "utf8")) as LabMetricsReport;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return this.report();
    }
  }

  async queueSummary(): Promise<string> {
    const candidates = await this.candidates();
    if (candidates.length === 0) return "- No lab candidates.";
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
      counts.set(candidate.candidateType, (counts.get(candidate.candidateType) ?? 0) + 1);
    }
    return [
      `Lab Candidates: ${candidates.length}`,
      ...Array.from(counts.entries()).map(([type, count]) => `- ${type}: ${count}`),
      "",
      "Recent:",
      ...candidates.slice(-10).reverse().map((candidate) => `- [${candidate.candidateType}] ${candidate.candidateId}`)
    ].join("\n");
  }

  async redteamSummary(): Promise<string> {
    const scenarioSets = (await this.scenarioSets()).filter((set) => set.domain === "redteam_governance");
    if (scenarioSets.length === 0) return "No redteam lab scenarios have been generated yet.";
    const latest = scenarioSets.at(-1);
    const tags = new Map<string, number>();
    for (const scenario of latest?.scenarios ?? []) {
      for (const tag of scenario.riskTags) {
        if (tag === "redteam" || tag === "synthetic") continue;
        tags.set(tag, (tags.get(tag) ?? 0) + 1);
      }
    }
    return [
      `Latest redteam scenario set: ${latest?.scenarioSetId}`,
      `Scenarios: ${latest?.scenarios.length ?? 0}`,
      "Risk Tags:",
      ...Array.from(tags.entries()).map(([tag, count]) => `- ${tag}: ${count}`)
    ].join("\n");
  }

  private async scenarioSets(): Promise<LabScenarioSet[]> {
    const dir = path.join(this.rootDir, "learning", "lab", "scenarios");
    return this.readJsonFiles(dir, (value) => LabScenarioSetSchema.parse(value));
  }

  private async runs(): Promise<LabRunRecord[]> {
    const dir = path.join(this.rootDir, "learning", "lab", "runs");
    return this.readJsonFiles(dir, (value) => LabRunRecordSchema.parse(value));
  }

  private async candidates(): Promise<LabCandidate[]> {
    const dirs = ["eval", "correction", "training", "memory"].map((type) =>
      path.join(this.rootDir, "learning", "lab", "candidates", type)
    );
    const candidates: LabCandidate[] = [];
    for (const dir of dirs) {
      candidates.push(...(await this.readJsonFiles(dir, (value) => LabCandidateSchema.parse(value))));
    }
    return candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private async readJsonFiles<T>(dir: string, parse: (value: unknown) => T): Promise<T[]> {
    try {
      const items: T[] = [];
      for (const entry of await fs.readdir(dir)) {
        if (!entry.endsWith(".json")) continue;
        items.push(parse(JSON.parse(await fs.readFile(path.join(dir, entry), "utf8"))));
      }
      return items;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
