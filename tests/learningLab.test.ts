import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatSession } from "../src/chat/ChatSession.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { CurriculumWorker } from "../src/lab/CurriculumWorker.js";
import { LabMetrics } from "../src/lab/LabMetrics.js";
import { LabRunner } from "../src/lab/LabRunner.js";
import {
  LabCandidateSchema,
  LabScenarioSetSchema,
  LearningWorkerResultSchema
} from "../src/lab/LearningWorker.js";
import { RedTeamGenerator } from "../src/lab/RedTeamGenerator.js";
import { ScenarioGenerator } from "../src/lab/ScenarioGenerator.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-lab-"));
}

describe("Learning Lab Workers", () => {
  it("validates worker results and requires approval for candidate creation", () => {
    expect(() =>
      LearningWorkerResultSchema.parse({
        workerId: "worker-1",
        role: "curriculum",
        createdAt: new Date().toISOString(),
        inputs: [],
        outputs: [],
        candidatesCreated: ["learning/lab/curricula/example.json"],
        warnings: [],
        requiresApproval: false
      })
    ).toThrow();

    expect(() =>
      LearningWorkerResultSchema.parse({
        workerId: "worker-1",
        role: "not_real",
        createdAt: new Date().toISOString(),
        inputs: [],
        outputs: [],
        candidatesCreated: [],
        warnings: [],
        requiresApproval: false
      })
    ).toThrow();
  });

  it("generates synthetic curriculum and scenario candidates", async () => {
    const rootDir = await tempRoot();
    const curriculum = await new CurriculumWorker(rootDir).generate({ domain: "planning", count: 5 });
    const scenarios = await new ScenarioGenerator(rootDir).generate({ curriculumPath: curriculum.path });

    expect(curriculum.pack.items).toHaveLength(5);
    expect(curriculum.pack.items.every((item) => item.synthetic && item.approvalState === "candidate")).toBe(true);
    expect(curriculum.pack.items.every((item) => item.targetMode === "planning")).toBe(true);
    expect(scenarios.scenarioSet.scenarios).toHaveLength(5);
    expect(scenarios.scenarioSet.scenarios.every((scenario) => scenario.synthetic)).toBe(true);
    await expect(fs.stat(path.join(rootDir, "evals", "regression", path.basename(scenarios.path)))).rejects.toThrow();
  });

  it("generates governance redteam scenarios", async () => {
    const rootDir = await tempRoot();
    const generated = await new RedTeamGenerator(rootDir).generate({ count: 13 });
    const tags = generated.scenarioSet.scenarios.flatMap((scenario) => scenario.riskTags);

    expect(generated.scenarioSet.scenarios).toHaveLength(13);
    expect(tags).toContain("promotion_bypass");
    expect(tags).toContain("stax_identity_confusion");
    expect(tags).toContain("learning_unit_self_approval");
    expect(generated.scenarioSet.scenarios.every((scenario) => scenario.synthetic && scenario.approvalState === "candidate")).toBe(true);
  });

  it("runs scenarios through STAX and creates candidate artifacts for failures", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const scenarioSet = LabScenarioSetSchema.parse({
      scenarioSetId: "scenario-set-failure",
      domain: "planning",
      createdAt: new Date().toISOString(),
      synthetic: true,
      approvalState: "candidate",
      scenarios: [
        {
          id: "planning-failure-001",
          sourceCurriculumId: "curriculum-item-001",
          domain: "planning",
          mode: "planning",
          input: "Make STAX better over time.",
          expectedProperties: [],
          forbiddenPatterns: [],
          requiredSections: ["## This Section Should Not Exist"],
          riskTags: ["synthetic"],
          critical: true,
          synthetic: true,
          approvalState: "candidate"
        }
      ]
    });
    const scenarioPath = path.join(rootDir, "learning", "lab", "scenarios", "forced-failure.json");
    await fs.mkdir(path.dirname(scenarioPath), { recursive: true });
    await fs.writeFile(scenarioPath, JSON.stringify(scenarioSet, null, 2), "utf8");

    const labRun = await new LabRunner(rootDir, runtime).runFile({ file: scenarioPath });
    const result = labRun.record.results[0];
    const evalCandidates = await fs.readdir(path.join(rootDir, "learning", "lab", "candidates", "eval"));
    const trainingCandidate = LabCandidateSchema.parse(
      JSON.parse(
        await fs.readFile(path.join(rootDir, "learning", "lab", "candidates", "training", (await fs.readdir(path.join(rootDir, "learning", "lab", "candidates", "training")))[0] ?? ""), "utf8")
      )
    );

    expect(result?.pass).toBe(false);
    expect(result?.runId).toContain("run-");
    expect(result?.learningEventId).toContain("learn-");
    expect(result?.queuesCreated.some((item) => item.includes("learning/lab/candidates/eval"))).toBe(true);
    expect(evalCandidates.length).toBe(1);
    expect(trainingCandidate.synthetic).toBe(true);
    await expect(fs.stat(path.join(rootDir, "training", "exports"))).rejects.toThrow();
  });

  it("reports metrics and supports read-only chat lab commands", async () => {
    const rootDir = await tempRoot();
    await new RedTeamGenerator(rootDir).generate({ count: 13 });
    const report = await new LabMetrics(rootDir).report();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    expect(report.scenariosGenerated).toBe(13);
    expect(report.byMode).toBeDefined();
    expect((await session.handleLine("/lab report")).output).toContain("scenariosGenerated");
    expect((await session.handleLine("/lab queue")).output).toContain("No lab candidates");
    expect((await session.handleLine("/lab redteam summary")).output).toContain("learning_unit_self_approval");
  });
});
