import fs from "node:fs/promises";
import path from "node:path";
import {
  LabCandidateSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  type LabCandidate,
  type LabResult,
  type LabScenario
} from "./LearningWorker.js";

export class EvalCandidateBuilder {
  constructor(private rootDir = process.cwd()) {}

  async build(input: { scenario: LabScenario; result: LabResult }): Promise<{ path: string; candidate: LabCandidate }> {
    await ensureLabDirs(this.rootDir);
    const createdAt = new Date().toISOString();
    const candidate = LabCandidateSchema.parse({
      candidateId: labId(`lab-eval-${input.scenario.id}`),
      candidateType: "eval",
      sourceScenarioId: input.scenario.id,
      runId: input.result.runId,
      learningEventId: input.result.learningEventId,
      createdAt,
      synthetic: true,
      approvalState: "candidate",
      requiresApproval: true,
      reason: `Failed lab scenario: ${input.result.failReasons.join("; ")}`,
      artifact: {
        name: input.scenario.id,
        mode: input.scenario.mode,
        input: input.scenario.input,
        requiredSections: input.scenario.requiredSections,
        expectedProperties: input.scenario.expectedProperties,
        forbiddenPatterns: input.scenario.forbiddenPatterns,
        critical: input.scenario.critical,
        source: "learning_lab_synthetic"
      }
    });
    const file = path.join(this.rootDir, "learning", "lab", "candidates", "eval", `${candidate.candidateId}.json`);
    await fs.writeFile(file, JSON.stringify(candidate, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), candidate };
  }
}
