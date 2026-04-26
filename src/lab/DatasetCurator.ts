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

export class DatasetCurator {
  constructor(private rootDir = process.cwd()) {}

  async buildTrainingCandidate(input: {
    scenario: LabScenario;
    result: LabResult;
    rejectedOutput: string;
  }): Promise<{ path: string; candidate: LabCandidate }> {
    await ensureLabDirs(this.rootDir);
    const createdAt = new Date().toISOString();
    const candidate = LabCandidateSchema.parse({
      candidateId: labId(`lab-training-${input.scenario.id}`),
      candidateType: "training",
      sourceScenarioId: input.scenario.id,
      runId: input.result.runId,
      learningEventId: input.result.learningEventId,
      createdAt,
      synthetic: true,
      approvalState: "candidate",
      requiresApproval: true,
      reason: "Synthetic preference candidate from failed lab scenario; never exported without approval.",
      artifact: {
        prompt: input.scenario.input,
        rejected: input.rejectedOutput,
        desiredProperties: input.scenario.expectedProperties,
        requiredSections: input.scenario.requiredSections,
        synthetic: true,
        source: "learning_lab_synthetic"
      }
    });
    const file = path.join(this.rootDir, "learning", "lab", "candidates", "training", `${candidate.candidateId}.json`);
    await fs.writeFile(file, JSON.stringify(candidate, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), candidate };
  }

  async buildMemoryCandidate(input: { scenario: LabScenario; result: LabResult }): Promise<{ path: string; candidate: LabCandidate }> {
    await ensureLabDirs(this.rootDir);
    const createdAt = new Date().toISOString();
    const candidate = LabCandidateSchema.parse({
      candidateId: labId(`lab-memory-${input.scenario.id}`),
      candidateType: "memory",
      sourceScenarioId: input.scenario.id,
      runId: input.result.runId,
      learningEventId: input.result.learningEventId,
      createdAt,
      synthetic: true,
      approvalState: "candidate",
      requiresApproval: true,
      reason: "Synthetic memory candidate only; do not store as approved memory without review.",
      artifact: {
        proposedMemory: `Learning Lab found a recurring ${input.scenario.domain} scenario pattern: ${input.scenario.input}`,
        synthetic: true,
        source: "learning_lab_synthetic"
      }
    });
    const file = path.join(this.rootDir, "learning", "lab", "candidates", "memory", `${candidate.candidateId}.json`);
    await fs.writeFile(file, JSON.stringify(candidate, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), candidate };
  }
}
