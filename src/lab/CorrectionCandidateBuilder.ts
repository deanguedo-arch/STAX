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

export class CorrectionCandidateBuilder {
  constructor(private rootDir = process.cwd()) {}

  async build(input: {
    scenario: LabScenario;
    result: LabResult;
    rejectedOutput: string;
  }): Promise<{ path: string; candidate: LabCandidate }> {
    await ensureLabDirs(this.rootDir);
    const createdAt = new Date().toISOString();
    const candidate = LabCandidateSchema.parse({
      candidateId: labId(`lab-correction-${input.scenario.id}`),
      candidateType: "correction",
      sourceScenarioId: input.scenario.id,
      runId: input.result.runId,
      learningEventId: input.result.learningEventId,
      createdAt,
      synthetic: true,
      approvalState: "candidate",
      requiresApproval: true,
      reason: `Correction candidate for failed lab scenario: ${input.result.failReasons.join("; ")}`,
      artifact: {
        rejectedOutput: input.rejectedOutput,
        chosenDraft: this.chosenDraft(input.scenario),
        failureTypes: input.result.failReasons,
        source: "learning_lab_synthetic"
      }
    });
    const file = path.join(this.rootDir, "learning", "lab", "candidates", "correction", `${candidate.candidateId}.json`);
    await fs.writeFile(file, JSON.stringify(candidate, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), candidate };
  }

  private chosenDraft(scenario: LabScenario): string {
    return [
      `Synthetic correction draft for ${scenario.mode}.`,
      "The approved output should satisfy:",
      ...scenario.requiredSections.map((section) => `- include ${section}`),
      ...scenario.expectedProperties.map((property) => `- property ${property}`),
      "Approval is required before this becomes a correction record."
    ].join("\n");
  }
}
