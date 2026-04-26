import fs from "node:fs/promises";
import path from "node:path";
import { createDefaultRuntime, type RaxRuntime } from "../core/RaxRuntime.js";
import { evaluateProperties } from "../evaluators/PropertyEvaluator.js";
import { EvalCandidateBuilder } from "./EvalCandidateBuilder.js";
import { CorrectionCandidateBuilder } from "./CorrectionCandidateBuilder.js";
import { DatasetCurator } from "./DatasetCurator.js";
import {
  LabRunRecordSchema,
  LabScenarioSetSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  resolveLabPath,
  type LabResult,
  type LabRunRecord,
  type LabScenario
} from "./LearningWorker.js";
import { LabMetrics } from "./LabMetrics.js";

type TraceWithLearning = {
  learningEventId?: string;
  learningQueues?: string[];
  boundaryMode?: string;
};

export class LabRunner {
  constructor(private rootDir = process.cwd(), private runtime?: RaxRuntime) {}

  async runFile(input: { file: string; createCandidates?: boolean }): Promise<{ path: string; record: LabRunRecord }> {
    await ensureLabDirs(this.rootDir);
    const scenarioFile = resolveLabPath(this.rootDir, input.file);
    const scenarioSet = LabScenarioSetSchema.parse(JSON.parse(await fs.readFile(scenarioFile, "utf8")));
    const runtime = this.runtime ?? (await createDefaultRuntime({ rootDir: this.rootDir }));
    const results: LabResult[] = [];
    for (const scenario of scenarioSet.scenarios) {
      const output = await runtime.run(scenario.input, [`Learning Lab synthetic scenario: ${scenario.id}`], {
        mode: scenario.mode
      });
      const runDir = path.join(this.rootDir, "runs", output.createdAt.slice(0, 10), output.runId);
      const tracePath = path.join(runDir, "trace.json");
      const finalPath = path.join(runDir, "final.md");
      const trace = JSON.parse(await fs.readFile(tracePath, "utf8")) as TraceWithLearning;
      const evaluation = evaluateProperties({
        output: output.output,
        requiredSections: scenario.requiredSections,
        forbiddenPatterns: scenario.forbiddenPatterns,
        expectedProperties: scenario.expectedProperties,
        critical: scenario.critical,
        actualBoundaryMode: trace.boundaryMode
      });
      const result: LabResult = {
        scenarioId: scenario.id,
        domain: scenario.domain,
        mode: scenario.mode,
        runId: output.runId,
        learningEventId: trace.learningEventId ?? "missing-learning-event",
        pass: evaluation.pass,
        failReasons: evaluation.failReasons,
        queuesCreated: trace.learningQueues ?? [],
        tracePath: relativeLabPath(this.rootDir, tracePath),
        finalPath: relativeLabPath(this.rootDir, finalPath)
      };
      if (!evaluation.pass && input.createCandidates !== false) {
        result.queuesCreated.push(...(await this.createCandidates(scenario, result, output.output)));
      }
      results.push(result);
    }
    const record = LabRunRecordSchema.parse({
      labRunId: labId("lab-run"),
      scenarioFile: relativeLabPath(this.rootDir, scenarioFile),
      createdAt: new Date().toISOString(),
      synthetic: true,
      results
    });
    const file = path.join(this.rootDir, "learning", "lab", "runs", `${record.labRunId}.json`);
    await fs.writeFile(file, JSON.stringify(record, null, 2), "utf8");
    await new LabMetrics(this.rootDir).report();
    return { path: relativeLabPath(this.rootDir, file), record };
  }

  private async createCandidates(scenario: LabScenario, result: LabResult, output: string): Promise<string[]> {
    const evalCandidate = await new EvalCandidateBuilder(this.rootDir).build({ scenario, result });
    const correctionCandidate = await new CorrectionCandidateBuilder(this.rootDir).build({
      scenario,
      result,
      rejectedOutput: output
    });
    const trainingCandidate = await new DatasetCurator(this.rootDir).buildTrainingCandidate({
      scenario,
      result,
      rejectedOutput: output
    });
    const created = [evalCandidate.path, correctionCandidate.path, trainingCandidate.path];
    if (scenario.riskTags.some((tag) => tag.includes("identity") || tag.includes("memory"))) {
      const memoryCandidate = await new DatasetCurator(this.rootDir).buildMemoryCandidate({ scenario, result });
      created.push(memoryCandidate.path);
    }
    return created;
  }
}
