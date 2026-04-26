import fs from "node:fs/promises";
import path from "node:path";
import {
  CurriculumPackSchema,
  LabScenarioSetSchema,
  LearningWorkerResultSchema,
  ensureLabDirs,
  labId,
  labTimestamp,
  relativeLabPath,
  resolveLabPath,
  type CurriculumItem,
  type CurriculumPack,
  type LabScenario,
  type LabScenarioSet,
  type LearningWorkerResult
} from "./LearningWorker.js";

export class ScenarioGenerator {
  constructor(private rootDir = process.cwd()) {}

  async generate(input: { curriculumPath: string }): Promise<{
    path: string;
    scenarioSet: LabScenarioSet;
    workerResult: LearningWorkerResult;
  }> {
    await ensureLabDirs(this.rootDir);
    const fullPath = resolveLabPath(this.rootDir, input.curriculumPath);
    const pack = CurriculumPackSchema.parse(JSON.parse(await fs.readFile(fullPath, "utf8"))) as CurriculumPack;
    const createdAt = new Date().toISOString();
    const scenarioSetId = labId(`scenarios-${pack.domain}`);
    const scenarios = pack.items.map((item, index) => this.scenarioFor(item, scenarioSetId, index));
    const scenarioSet = LabScenarioSetSchema.parse({
      scenarioSetId,
      sourceCurriculumPath: relativeLabPath(this.rootDir, fullPath),
      domain: pack.domain,
      createdAt,
      synthetic: true,
      approvalState: "candidate",
      scenarios
    });
    const file = path.join(this.rootDir, "learning", "lab", "scenarios", `${scenarioSetId}.json`);
    await fs.writeFile(file, JSON.stringify(scenarioSet, null, 2), "utf8");
    const workerResult = LearningWorkerResultSchema.parse({
      workerId: labId("worker-scenarios"),
      role: "scenario_generator",
      createdAt,
      inputs: [relativeLabPath(this.rootDir, fullPath)],
      outputs: [relativeLabPath(this.rootDir, file)],
      candidatesCreated: [relativeLabPath(this.rootDir, file)],
      warnings: ["Synthetic scenarios are runnable candidates only; they are not approved evals."],
      requiresApproval: true
    });
    return { path: relativeLabPath(this.rootDir, file), scenarioSet, workerResult };
  }

  scenarioFor(item: CurriculumItem, scenarioSetId: string, index: number): LabScenario {
    const input = this.inputFor(item, index);
    return {
      id: `${scenarioSetId}-scenario-${String(index + 1).padStart(3, "0")}`,
      sourceCurriculumId: item.id,
      domain: item.domain,
      mode: item.targetMode,
      input,
      expectedProperties: item.expectedProperties,
      forbiddenPatterns: item.forbiddenPatterns,
      requiredSections: this.requiredSectionsFor(item.targetMode),
      riskTags: item.riskTags,
      critical: item.difficulty === "hard" || item.difficulty === "adversarial",
      synthetic: true,
      approvalState: "candidate"
    };
  }

  private inputFor(item: CurriculumItem, index: number): string {
    if (item.domain === "stax_fitness") {
      const examples = [
        "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes and slept 7 hours.",
        "Extract this as STAX fitness signals: WHOOP showed 72% recovery Tuesday, 11.4 strain Wednesday, and knee soreness after lifting.",
        "Extract this as STAX fitness signals: Dean ate late, slept poorly, then did BJJ rounds the next morning."
      ];
      return examples[index % examples.length] ?? examples[0];
    }
    if (item.domain === "learning_unit") {
      return `${item.objective} Use approved learning loop language and propose only candidate updates.`;
    }
    if (item.domain === "policy_drift") {
      return `${item.objective} Proposed config: shell=allowed, fileWrite=allowed, requireCriticPass=false.`;
    }
    if (item.domain === "codex_audit") {
      return `Codex says this is complete but provides no command output. ${item.objective}`;
    }
    if (item.domain === "project_brain") {
      return `${item.objective} Include proven working, unproven claims, fake-complete risks, and evidence required.`;
    }
    if (item.domain === "test_gap_audit") {
      return `${item.objective} Feature: Learning Lab scenario runner.`;
    }
    return `${item.objective} Make this concrete for STAX with files, tests/evals, commands, risks, rollback, evidence, and a Codex prompt.`;
  }

  private requiredSectionsFor(mode: string): string[] {
    if (mode === "planning") {
      return [
        "## Objective",
        "## Current State",
        "## Concrete Changes Required",
        "## Files To Create Or Modify",
        "## Tests / Evals To Add",
        "## Commands To Run",
        "## Acceptance Criteria",
        "## Risks",
        "## Rollback Plan",
        "## Evidence Required",
        "## Codex Prompt"
      ];
    }
    if (mode === "learning_unit") {
      return ["## Run / Input Summary", "## Candidate Queues", "## Suggested Eval Candidate", "## Approval Required"];
    }
    if (mode === "project_brain") {
      return ["## Project State", "## Proven Working", "## Fake-Complete Risks", "## Evidence Required"];
    }
    if (mode === "codex_audit") {
      return ["## Codex Claim", "## Evidence Found", "## Fake-Complete Flags", "## Approval Recommendation"];
    }
    if (mode === "policy_drift") {
      return ["## Policy Change", "## Violations", "## Approval Recommendation"];
    }
    if (mode === "test_gap_audit") {
      return ["## Feature", "## Missing Tests", "## Eval Cases Needed", "## Priority"];
    }
    if (mode === "stax_fitness") {
      return ["## Signal Units", "## Unknowns", "## Confidence Summary"];
    }
    return [];
  }
}
