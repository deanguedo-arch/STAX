import fs from "node:fs/promises";
import path from "node:path";
import {
  FailureClusterSchema,
  LabRunRecordSchema,
  LabScenarioSetSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  type FailureCluster,
  type LabResult,
  type LabRunRecord,
  type LabScenario
} from "./LearningWorker.js";

type ClusterDraft = {
  failureType: FailureCluster["failureType"];
  mode: FailureCluster["mode"];
  domain: FailureCluster["domain"];
  examples: FailureCluster["examples"];
  suggestedQueueTypes: string[];
  severity: FailureCluster["severity"];
};

export class FailureMiner {
  constructor(private rootDir = process.cwd()) {}

  async mine(input: { records?: LabRunRecord[] } = {}): Promise<{
    path: string;
    clusters: FailureCluster[];
  }> {
    await ensureLabDirs(this.rootDir);
    const records = input.records ?? (await this.readRuns());
    const scenarios = await this.scenarioMap();
    const drafts = new Map<string, ClusterDraft>();
    for (const record of records) {
      for (const result of record.results) {
        if (result.pass) continue;
        const scenario = scenarios.get(result.scenarioId);
        for (const reason of result.failReasons) {
          const failureType = this.failureType(reason);
          const key = `${result.mode}:${result.domain}:${failureType}:${this.reasonKey(reason)}`;
          const severity = this.severity(failureType, scenario, result);
          const existing = drafts.get(key);
          const example = {
            scenarioId: result.scenarioId,
            runId: result.runId,
            learningEventId: result.learningEventId,
            tracePath: result.tracePath,
            finalPath: result.finalPath,
            reason
          };
          if (existing) {
            existing.examples.push(example);
            existing.severity = this.maxSeverity(existing.severity, severity);
          } else {
            drafts.set(key, {
              failureType,
              mode: result.mode,
              domain: result.domain,
              examples: [example],
              suggestedQueueTypes: this.suggestedQueues(failureType, scenario),
              severity
            });
          }
        }
      }
    }
    const clusters = Array.from(drafts.values()).map((draft) =>
      FailureClusterSchema.parse({
        clusterId: labId(`cluster-${draft.failureType}`),
        failureType: draft.failureType,
        mode: draft.mode,
        domain: draft.domain,
        count: draft.examples.length,
        examples: draft.examples,
        suggestedQueueTypes: draft.suggestedQueueTypes,
        severity: draft.examples.length > 1 ? this.maxSeverity(draft.severity, "major") : draft.severity
      })
    );
    const file = path.join(this.rootDir, "learning", "lab", "reports", "failures-latest.json");
    await fs.writeFile(file, JSON.stringify(clusters, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), clusters };
  }

  async readLatest(): Promise<FailureCluster[]> {
    try {
      return JSON.parse(
        await fs.readFile(path.join(this.rootDir, "learning", "lab", "reports", "failures-latest.json"), "utf8")
      ) as FailureCluster[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return (await this.mine()).clusters;
    }
  }

  private failureType(reason: string): FailureCluster["failureType"] {
    const lower = reason.toLowerCase();
    if (lower.includes("missing required section")) return "missing_section";
    if (lower.includes("generic")) return "generic_output";
    if (lower.includes("policy") || lower.includes("approval") || lower.includes("tool")) return "policy_gap";
    if (lower.includes("boundary") || lower.includes("routing")) return "routing_error";
    if (lower.includes("schema")) return "schema_failure";
    if (lower.includes("critic")) return "critic_failure";
    if (lower.includes("replay")) return "replay_drift";
    if (lower.includes("expected property")) return "expected_property";
    if (lower.includes("forbidden pattern")) return "forbidden_pattern";
    return "unknown_failure";
  }

  private reasonKey(reason: string): string {
    return reason.replace(/: .*/, "").toLowerCase();
  }

  private severity(
    failureType: FailureCluster["failureType"],
    scenario: LabScenario | undefined,
    result: LabResult
  ): FailureCluster["severity"] {
    const tags = scenario?.riskTags ?? [];
    if (
      result.failReasons.some((reason) => /promotion|memory approved|policy patched|shell=allowed|filewrite=allowed/i.test(reason)) ||
      tags.some((tag) =>
        [
          "promotion_bypass",
          "tool_misuse",
          "memory_poisoning",
          "policy_bypass",
          "schema_bypass",
          "learning_unit_self_approval"
        ].includes(tag)
      )
    ) {
      return "critical";
    }
    if (["policy_gap", "schema_failure", "critic_failure", "replay_drift"].includes(failureType)) return "major";
    return "minor";
  }

  private suggestedQueues(failureType: FailureCluster["failureType"], scenario: LabScenario | undefined): string[] {
    const queues = new Set<string>(["eval_candidate"]);
    if (["missing_section", "generic_output", "expected_property"].includes(failureType)) {
      queues.add("mode_contract_patch_candidate");
      queues.add("codex_prompt_candidate");
    }
    if (["policy_gap", "routing_error", "schema_failure", "critic_failure", "replay_drift"].includes(failureType)) {
      queues.add("policy_patch_candidate");
    }
    if (scenario?.riskTags.some((tag) => tag.includes("memory"))) queues.add("memory_candidate");
    return Array.from(queues);
  }

  private maxSeverity(
    left: FailureCluster["severity"],
    right: FailureCluster["severity"]
  ): FailureCluster["severity"] {
    const order: Record<FailureCluster["severity"], number> = { minor: 0, major: 1, critical: 2 };
    return order[right] > order[left] ? right : left;
  }

  private async readRuns(): Promise<LabRunRecord[]> {
    return this.readJsonFiles(path.join(this.rootDir, "learning", "lab", "runs"), (value) =>
      LabRunRecordSchema.parse(value)
    );
  }

  private async scenarioMap(): Promise<Map<string, LabScenario>> {
    const sets = await this.readJsonFiles(path.join(this.rootDir, "learning", "lab", "scenarios"), (value) =>
      LabScenarioSetSchema.parse(value)
    );
    return new Map(sets.flatMap((set) => set.scenarios.map((scenario) => [scenario.id, scenario] as const)));
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
