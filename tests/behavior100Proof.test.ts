import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createCorrection, promoteCorrection } from "../src/core/Corrections.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { replayRun } from "../src/core/Replay.js";
import type {
  CompleteRequest,
  CompleteResponse,
  ModelProvider
} from "../src/providers/ModelProvider.js";
import { extractStaxSignals } from "../src/agents/StaxSignalExtractor.js";
import { TrainingExporter } from "../src/training/TrainingExporter.js";

const execFileAsync = promisify(execFile);

class NamedProvider implements ModelProvider {
  calls: CompleteRequest[] = [];

  constructor(
    public name: string,
    public model: string
  ) {}

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    this.calls.push(request);
    return { text: `${this.name}:${this.model}` };
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}

describe("100 percent proof gates", () => {
  it("uses distinct role providers in actual generator, critic, and formatter calls", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-100-role-"));
    const generator = new NamedProvider("mock-generator-A", "gen-model");
    const critic = new NamedProvider("mock-critic-B", "critic-model");
    const formatter = new NamedProvider("mock-formatter-C", "formatter-model");
    const runtime = await createDefaultRuntime({
      rootDir,
      roleProviders: { generator, critic, formatter }
    });

    const output = await runtime.run("Build a project plan.");
    const trace = await readJson<{
      modelCalls: Array<{ role: string; provider: string; model: string }>;
    }>(
      path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId, "trace.json")
    );

    expect(generator.calls).toHaveLength(1);
    expect(critic.calls).toHaveLength(1);
    expect(formatter.calls).toHaveLength(1);
    expect(trace.modelCalls.map((call) => ({
      role: call.role,
      provider: call.provider,
      model: call.model
    }))).toEqual([
      { role: "generator", provider: "mock-generator-A", model: "gen-model" },
      { role: "critic", provider: "mock-critic-B", model: "critic-model" },
      { role: "formatter", provider: "mock-formatter-C", model: "formatter-model" }
    ]);
  });

  it("hard-stops critical STAX critic failures before repair and formatter", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-100-critical-"));
    const runtime = await createDefaultRuntime({ rootDir });

    const output = await runtime.run(
      "STAX: Dean trained once, this proves he is clearly a disciplined person.",
      [],
      { mode: "stax_fitness" }
    );
    const runDir = path.join(rootDir, "runs", output.createdAt.slice(0, 10), output.runId);
    const trace = await readJson<{
      formatterPasses: number;
      repairPasses: number;
      validation: { valid?: boolean };
      modelCalls: Array<{ role: string }>;
      errors: string[];
    }>(path.join(runDir, "trace.json"));
    const repairLog = await fs.readFile(path.join(runDir, "repair.md"), "utf8");
    const final = await fs.readFile(path.join(runDir, "final.md"), "utf8");

    expect(final).toContain("## Critic Failure");
    expect(trace.formatterPasses).toBe(0);
    expect(trace.repairPasses).toBe(0);
    expect(trace.validation.valid).toBe(false);
    expect(trace.modelCalls.map((call) => call.role)).toEqual(["generator", "critic"]);
    expect(trace.errors.join(" ")).toContain("STAX fitness forbidden phrasing detected");
    expect(repairLog).toContain("not_attempted_due_to_critical");
  });

  it("fails the eval CLI for a critical negative-control fixture", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-100-cli-eval-"));
    await fs.mkdir(path.join(rootDir, "evals", "cases"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "evals", "cases", "critical-bad.json"),
      JSON.stringify({
        id: "critical-bad",
        mode: "stax_fitness",
        input: "Dean trained BJJ Saturday.",
        expectedProperties: [],
        forbiddenPatterns: [],
        requiredSections: ["## Missing Section"],
        minSignalUnits: 2,
        critical: true,
        tags: ["negative-control"]
      }),
      "utf8"
    );

    const repoRoot = process.cwd();
    const tsxBin = path.join(
      repoRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "tsx.cmd" : "tsx"
    );
    const cliPath = path.join(repoRoot, "src", "cli.ts");

    const command = process.platform === "win32" ? "cmd.exe" : tsxBin;
    const commandArgs =
      process.platform === "win32"
        ? ["/c", tsxBin, cliPath, "eval"]
        : [cliPath, "eval"];

    await expect(
      execFileAsync(command, commandArgs, { cwd: rootDir })
    ).rejects.toMatchObject({ code: 1 });
  }, 30000);

  it("extracts messy STAX pasted observations into atomic typed signals", () => {
    const signals = extractStaxSignals([
      "Saturday: Dean trained BJJ for 90 minutes.",
      "Sunday: slept 8 hours.",
      "WHOOP showed recovery 34%, strain 11.8.",
      'He said "my knee felt stable."',
      "Ate 220g protein."
    ].join("\n"));

    expect(signals.length).toBeGreaterThanOrEqual(6);
    expect(signals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining(["training", "sleep", "recovery", "strain", "injury", "nutrition"])
    );
    expect(signals.some((signal) =>
      signal.rawInput.includes('"') && signal.rawInput.includes("my knee felt stable")
    )).toBe(true);
    expect(signals.every((signal) => signal.confidence)).toBe(true);
  });

  it("promotes corrections into regression eval, training, golden, and JSONL exports", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-100-correction-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const run = await runtime.run(
      "Dean trained BJJ Saturday for 90 minutes and slept 8 hours Sunday.",
      [],
      { mode: "stax_fitness" }
    );
    const correctedOutput = [
      "## Signal Units",
      "",
      "### SU-001",
      "- Type: training",
      "- Source: user",
      "- Timestamp: Saturday",
      "- Raw Input: Dean trained BJJ Saturday for 90 minutes",
      "- Observed Fact: Dean trained BJJ for 90 minutes",
      "- Inference: Unknown",
      "- Confidence: medium",
      "",
      "### SU-002",
      "- Type: sleep",
      "- Source: user",
      "- Timestamp: Sunday",
      "- Raw Input: Dean slept 8 hours Sunday",
      "- Observed Fact: Dean slept 8 hours",
      "- Inference: Unknown",
      "- Confidence: medium",
      "",
      "## Timeline",
      "- Saturday: Dean trained BJJ for 90 minutes",
      "- Sunday: Dean slept 8 hours",
      "",
      "## Pattern Candidates",
      "- Insufficient signals",
      "",
      "## Deviations",
      "- Insufficient baseline",
      "",
      "## Unknowns",
      "- Supporting context",
      "",
      "## Confidence Summary",
      "medium"
    ].join("\n");

    const correction = await createCorrection({
      rootDir,
      runId: run.runId,
      correctedOutput,
      reason: "Split BJJ training and sleep into separate STAX signal units.",
      errorType: "missing_signal",
      policyViolated: "evidence_policy",
      tags: ["stax", "atomic"]
    });
    const promoted = await promoteCorrection({
      rootDir,
      correctionId: correction.correctionId,
      promoteToEval: true,
      promoteToTraining: true,
      promoteToGolden: true
    });

    expect(promoted.evalPath).toBeTruthy();
    expect(promoted.trainingPath).toBeTruthy();
    expect(promoted.goldenPath).toBeTruthy();
    const evalCase = await readJson<{
      input: string;
      mode: string;
      minSignalUnits?: number;
      requiredSections: string[];
    }>(promoted.evalPath!);
    expect(evalCase.input).toContain("Dean trained BJJ Saturday");
    expect(evalCase.mode).toBe("stax_fitness");
    expect(evalCase.minSignalUnits).toBe(2);
    expect(evalCase.requiredSections).toContain("## Signal Units");

    const sft = await new TrainingExporter(rootDir).exportSft();
    const preference = await new TrainingExporter(rootDir).exportPreference();
    const sftRaw = await fs.readFile(sft.path, "utf8");
    const preferenceRaw = await fs.readFile(preference.path, "utf8");
    const prefRecord = JSON.parse(preferenceRaw.trim()) as { chosen: string; rejected: string };

    expect(sftRaw).toContain(correction.correctionId);
    expect(prefRecord.chosen).toContain("### SU-002");
    expect(prefRecord.rejected).toContain("## Signal Units");
  });

  it("reports trace-level replay drift for deterministic fields", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-100-replay-"));
    const runtime = await createDefaultRuntime({ rootDir });
    const run = await runtime.run("Build a project plan.");
    const runDir = path.join(rootDir, "runs", run.createdAt.slice(0, 10), run.runId);
    const tracePath = path.join(runDir, "trace.json");
    const trace = await readJson<{ policiesApplied: string[] }>(tracePath);
    trace.policiesApplied = ["tampered_policy@1.0.0"];
    await fs.writeFile(tracePath, JSON.stringify(trace, null, 2), "utf8");

    const replay = await replayRun({
      rootDir,
      runId: run.runId,
      date: run.createdAt.slice(0, 10)
    });

    expect(replay.exact).toBe(false);
    expect(replay.outputDiffSummary).toBe("exact match");
    expect(replay.traceDiffSummary).toContain("policiesApplied");
  });
});
