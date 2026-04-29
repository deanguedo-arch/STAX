#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ChatSession } from "./chat/ChatSession.js";
import { createCorrection, promoteCorrection } from "./core/Corrections.js";
import { loadConfig, mergeConfig } from "./core/ConfigLoader.js";
import { runEvals } from "./core/EvalRunner.js";
import { replayRun } from "./core/Replay.js";
import { createDefaultRuntime } from "./core/RaxRuntime.js";
import { BehaviorMiner } from "./compare/BehaviorMiner.js";
import { BehaviorRequirementTriage } from "./compare/BehaviorRequirementTriage.js";
import { BenchmarkAdversary } from "./compare/BenchmarkAdversary.js";
import { LocalProblemBenchmark } from "./compare/LocalProblemBenchmark.js";
import { ExternalBaselineImport } from "./compare/ExternalBaselineImport.js";
import { ProblemBenchmarkCaseSchema, ProblemBenchmarkCollectionSchema, type ProblemBenchmarkCase } from "./compare/ProblemBenchmarkSchemas.js";
import { collectLocalEvidence, formatLocalEvidence } from "./evidence/LocalEvidenceCollector.js";
import { CommandEvidenceStore } from "./evidence/CommandEvidenceStore.js";
import { EvidenceCollector } from "./evidence/EvidenceCollector.js";
import { ControlAuditCaseRunner } from "./control/ControlAuditCaseRunner.js";
import { SystemDoctor } from "./doctor/SystemDoctor.js";
import { DisagreementCapture } from "./learning/DisagreementCapture.js";
import { LearningEventSchema, LearningQueueTypeSchema } from "./learning/LearningEvent.js";
import { LearningMetricsStore } from "./learning/LearningMetrics.js";
import { LearningProposalGenerator } from "./learning/LearningProposalGenerator.js";
import { LearningQueue } from "./learning/LearningQueue.js";
import { LearningRecorder } from "./learning/LearningRecorder.js";
import { LearningRetention } from "./learning/LearningRetention.js";
import { PromotionGate, type PromotionTarget } from "./learning/PromotionGate.js";
import { CurriculumWorker } from "./lab/CurriculumWorker.js";
import { FailureMiner } from "./lab/FailureMiner.js";
import { LabMetrics } from "./lab/LabMetrics.js";
import { LabOrchestrator } from "./lab/LabOrchestrator.js";
import { LabRunner } from "./lab/LabRunner.js";
import { PatchPlanner } from "./lab/PatchPlanner.js";
import { RedTeamGenerator } from "./lab/RedTeamGenerator.js";
import { CodexHandoffWorker } from "./lab/CodexHandoffWorker.js";
import { ReleaseGate } from "./lab/ReleaseGate.js";
import { ScenarioGenerator } from "./lab/ScenarioGenerator.js";
import { VerificationWorker } from "./lab/VerificationWorker.js";
import { MemoryStore } from "./memory/MemoryStore.js";
import { ModeRegistry } from "./modes/ModeRegistry.js";
import { PolicyCompiler } from "./policy/PolicyCompiler.js";
import { PolicyLoader } from "./policy/PolicyLoader.js";
import { PolicySelector } from "./policy/PolicySelector.js";
import { RiskClassifier } from "./safety/RiskClassifier.js";
import { BoundaryDecision } from "./safety/BoundaryDecision.js";
import { DEFAULT_CONFIG, type DetailLevel, type RaxMode } from "./schemas/Config.js";
import { TrainingExporter } from "./training/TrainingExporter.js";
import { TrainingQualityGate } from "./training/TrainingQualityGate.js";
import { createRunId } from "./utils/ids.js";
import { logError, logInfo } from "./utils/logger.js";
import { WorkspaceContext, type ResolvedWorkspaceContext } from "./workspace/WorkspaceContext.js";
import { WorkspaceStore } from "./workspace/WorkspaceStore.js";
import { RepoSummary } from "./workspace/RepoSummary.js";
import { RepoSearch } from "./workspace/RepoSearch.js";
import { ReviewBatcher } from "./review/ReviewBatcher.js";
import { ReviewLedger } from "./review/ReviewLedger.js";
import { ReviewQueue } from "./review/ReviewQueue.js";
import { ReviewRouter } from "./review/ReviewRouter.js";
import { ReviewStatsStore } from "./review/ReviewStats.js";
import { ReviewDispositionSchema, ReviewRiskLevelSchema } from "./review/ReviewSchemas.js";
import { GeneralSuperiorityGate } from "./superiority/GeneralSuperiorityGate.js";
import { StrategicBenchmark } from "./strategy/StrategicBenchmark.js";
import { SandboxCommandWindow } from "./verification/SandboxCommandWindow.js";
import { SandboxDependencyBootstrap } from "./verification/SandboxDependencyBootstrap.js";
import { SandboxGuard } from "./verification/SandboxGuard.js";
import { SandboxPatchWindow } from "./verification/SandboxPatchWindow.js";
import { WorkPacketPlanner } from "./verification/WorkPacketPlanner.js";
import { SandboxLoopRunner } from "./loop/SandboxLoopRunner.js";

type ParsedArgs = {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
};

const knownCommands = new Set([
  "run",
  "control-audit",
  "batch",
  "eval",
  "replay",
  "memory",
  "correct",
  "corrections",
  "train",
  "policy",
  "mode",
  "chat",
  "codex-audit-local",
  "trace",
  "show",
  "learn",
  "lab",
  "evidence",
  "workspace",
  "disagree",
  "compare",
  "superiority",
  "strategy",
  "auto-advance",
  "mine",
  "review",
  "doctor",
  "help"
]);

function parseArgs(argv: string[]): ParsedArgs {
  const first = argv[0];
  const command = first && knownCommands.has(first) ? first : "run";
  const remaining = command === "run" && first && !knownCommands.has(first) ? argv : argv.slice(1);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = remaining[index + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (arg) {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

async function runCommand(args: ParsedArgs): Promise<void> {
  const file = args.flags.file;
  const input =
    typeof file === "string"
      ? await fs.readFile(file, "utf8")
      : args.positional.join(" ");

  if (!input.trim()) {
    throw new Error("No input supplied.");
  }

  const runtime = await createDefaultRuntime();
  const workspace = await new WorkspaceContext().resolve({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  const output = await runtime.run(input, [], {
    mode: typeof args.flags.mode === "string" ? (args.flags.mode as RaxMode) : undefined,
    detailLevel:
      typeof args.flags.detail === "string"
        ? (args.flags.detail as DetailLevel)
        : undefined,
    workspace: workspace.workspace,
    linkedRepoPath: workspace.linkedRepoPath
  });
  if (args.flags.print === "json") {
    logInfo(JSON.stringify(output, null, 2));
    return;
  }
  if (args.flags.print === "summary") {
    logInfo(`Run: ${output.runId}`);
    logInfo(`Mode: ${output.taskMode}`);
    logInfo(`Validation: ${output.validation.valid ? "passed" : "failed"}`);
    return;
  }
  logInfo(output.output);
  logInfo("");
  logInfo(`Run: ${output.runId}`);
  logInfo(`Run folder: ${path.join("runs", output.createdAt.slice(0, 10), output.runId)}`);
}

async function controlAuditCommand(args: ParsedArgs): Promise<void> {
  const caseFile = typeof args.flags.case === "string" ? args.flags.case : undefined;
  const caseId = typeof args.flags["case-id"] === "string" ? args.flags["case-id"] : undefined;
  if (!caseFile) {
    throw new Error("Usage: rax control-audit --case fixtures/control_audits/<case>.json [--case-id <id>] [--print json]");
  }

  const runtime = await createDefaultRuntime();
  const workspace = await new WorkspaceContext().resolve({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  const runner = new ControlAuditCaseRunner(runtime);
  const caseData = await runner.loadFromFile(caseFile, { caseId });
  const run = await runner.runCase(caseData, {
    workspace: workspace.workspace,
    linkedRepoPath: workspace.linkedRepoPath
  });

  const success = run.result.validation.valid;
  if (args.flags.print === "json") {
    const payload = {
      caseId: run.caseData.caseId,
      prompt: run.prompt,
      result: run.result
    };
    const stdout = JSON.stringify(payload, null, 2);
    logInfo(stdout);
    await recordCommandEvent("control-audit", args, success, stdout, [], run.result.runId, workspace);
  } else {
    const stdout = [
      `Case: ${run.caseData.caseId}`,
      "",
      run.result.output,
      "",
      `Run: ${run.result.runId}`,
      `Run folder: ${path.join("runs", run.result.createdAt.slice(0, 10), run.result.runId)}`
    ].join("\n");
    logInfo(stdout);
    await recordCommandEvent("control-audit", args, success, stdout, [], run.result.runId, workspace);
  }

  if (!success) {
    process.exitCode = 1;
  }
}

async function batchCommand(args: ParsedArgs): Promise<void> {
  const folder = args.positional[0];
  if (!folder) {
    throw new Error("Usage: rax batch <folder>");
  }

  const runtime = await createDefaultRuntime();
  const workspace = await new WorkspaceContext().resolve({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  const loaded = await loadConfig(process.cwd());
  const config = mergeConfig(DEFAULT_CONFIG, loaded);
  const entries = (await fs.readdir(folder))
    .filter((entry) => /\.(txt|md|markdown)$/i.test(entry))
    .slice(0, config.limits.maxBatchFiles);
  const batchId = createRunId().replace(/^run-/, "batch-");
  const createdAt = new Date().toISOString();
  const summary: Array<{ file: string; runId?: string; error?: string }> = [];
  for (const entry of entries) {
    const fullPath = path.join(folder, entry);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      continue;
    }
    try {
      const input = await fs.readFile(fullPath, "utf8");
      const output = await runtime.run(input, [], {
        mode: typeof args.flags.mode === "string" ? (args.flags.mode as RaxMode) : undefined,
        workspace: workspace.workspace,
        linkedRepoPath: workspace.linkedRepoPath
      });
      summary.push({ file: entry, runId: output.runId });
      logInfo(`${entry}: ${output.runId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.push({ file: entry, error: message });
      logError(`${entry}: ${message}`);
    }
  }
  const summaryPath = path.join(
    "runs",
    createdAt.slice(0, 10),
    `${batchId}.json`
  );
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(
    summaryPath,
    JSON.stringify({ batchId, createdAt, folder, count: summary.length, results: summary }, null, 2),
    "utf8"
  );
  logInfo(`Batch summary: ${summaryPath}`);
}

async function evalCommand(args: ParsedArgs): Promise<void> {
  const folder = args.flags.redteam
    ? "redteam"
    : args.flags.regression
      ? "regression"
      : "cases";
  const workspace = await new WorkspaceContext().resolve({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  const result = await runEvals({
    folder,
    mode: typeof args.flags.mode === "string" ? args.flags.mode : undefined,
    workspace: workspace.workspace,
    linkedRepoPath: workspace.linkedRepoPath
  });
  const stdout = JSON.stringify(result, null, 2);
  logInfo(stdout);
  const success = result.failed === 0 && result.criticalFailures === 0;
  const commandEvidence = await recordCommandEvidence(commandLineFor(args), args, success ? 0 : 1, stdout, "", evalSummary(folder, result), workspace);
  await recordCommandEvent("eval", args, success, stdout, [commandEvidencePath(commandEvidence), commandEvidence.stdoutPath, commandEvidence.stderrPath], undefined, workspace);
  if (result.failed > 0 || result.criticalFailures > 0 || result.passRate < DEFAULT_CONFIG.evals.minimumPassRate) {
    process.exitCode = 1;
  }
}

async function doctorCommand(args: ParsedArgs): Promise<void> {
  const doctor = new SystemDoctor(process.cwd());
  const report = await doctor.inspect({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  logInfo(args.flags.print === "json" ? JSON.stringify(report, null, 2) : doctor.format(report));
}

async function replayCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  const date = typeof args.flags.date === "string" ? args.flags.date : undefined;
  if (!runId) {
    throw new Error("Usage: rax replay <run-id>");
  }
  const result = await replayRun({ runId, date });
  const stdout = JSON.stringify(result, null, 2);
  logInfo(stdout);
  const workspace = await new WorkspaceContext().resolve({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  const commandEvidence = await recordCommandEvidence(
    commandLineFor(args),
    args,
    result.exact ? 0 : 1,
    stdout,
    "",
    result.exact ? "Replay matched original output and deterministic trace fields." : result.reason ?? "Replay differed.",
    workspace
  );
  await recordCommandEvent("replay", args, result.exact, stdout, [result.replayRunId, commandEvidencePath(commandEvidence)], undefined, workspace);
  if (!result.exact) {
    process.exitCode = 1;
  }
}

async function memoryCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0];
  const query = args.positional.slice(1).join(" ");
  const store = new MemoryStore();
  if (action === "search") {
    const results = await store.search(query);
    logInfo(JSON.stringify(results, null, 2));
    return;
  }
  if (action === "list") {
    const results = await store.search("");
    logInfo(JSON.stringify(results, null, 2));
    return;
  }
  if (action === "approve") {
    const reason = typeof args.flags.reason === "string" ? args.flags.reason : "";
    const approvedBy = typeof args.flags.by === "string" ? args.flags.by : "cli";
    const sourceRunId = typeof args.flags.run === "string" ? args.flags.run : undefined;
    const expiresAt = typeof args.flags.expires === "string" ? args.flags.expires : undefined;
    const neverExpireJustification =
      typeof args.flags["never-expire-justification"] === "string"
        ? args.flags["never-expire-justification"]
        : undefined;
    if (!reason.trim()) {
      throw new Error("Usage: rax memory approve <id> --reason \"...\" [--by reviewer] [--run <run-id>] [--expires <iso-date> | --never-expire-justification \"...\"]");
    }
    logInfo(JSON.stringify(await store.approve(args.positional[1] ?? "", {
      approvedBy,
      approvalReason: reason,
      sourceRunId,
      expiresAt,
      neverExpireJustification
    }), null, 2));
    return;
  }
  if (action === "reject") {
    logInfo(JSON.stringify(await store.reject(args.positional[1] ?? "", {
      rejectedBy: typeof args.flags.by === "string" ? args.flags.by : "cli",
      rejectionReason: typeof args.flags.reason === "string" ? args.flags.reason : undefined
    }), null, 2));
    return;
  }
  throw new Error('Usage: rax memory search "query" | list | approve <id> --reason "..." | reject <id>');
}

async function correctCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  const date = typeof args.flags.date === "string" ? args.flags.date : undefined;
  const outputFile =
    typeof args.flags.file === "string"
      ? args.flags.file
      : typeof args.flags.output === "string"
        ? args.flags.output
        : undefined;
  const reason =
    typeof args.flags.reason === "string" ? args.flags.reason : "unspecified";

  if (!runId || !outputFile) {
    throw new Error(
      "Usage: rax correct <run-id> --file corrected.md --reason \"...\""
    );
  }

  const correctedOutput = await fs.readFile(outputFile, "utf8");
  const record = await createCorrection({
    runId,
    date,
    correctedOutput,
    reason,
    errorType:
      typeof args.flags.errorType === "string"
        ? (args.flags.errorType as never)
        : undefined,
    policyViolated:
      typeof args.flags.policy === "string" ? args.flags.policy : undefined
  });
  logInfo(record.path);
  await recordCommandEvent("correct", args, true, record.path, [record.path], runId);
}

async function correctionsCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0];
  if (action === "list") {
    const dirs = ["pending", "approved", "rejected"];
    const records: unknown[] = [];
    for (const dir of dirs) {
      const full = path.join("corrections", dir);
      try {
        for (const entry of await fs.readdir(full)) {
          if (entry.endsWith(".json")) {
            records.push(JSON.parse(await fs.readFile(path.join(full, entry), "utf8")));
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    logInfo(JSON.stringify(records, null, 2));
    return;
  }
  if (action === "promote") {
    const correctionId = args.positional[1];
    if (!correctionId) throw new Error("Usage: rax corrections promote <correction-id>");
    const result = await promoteCorrection({
      correctionId,
      promoteToEval: Boolean(args.flags.eval),
      promoteToTraining: Boolean(args.flags.training),
      promoteToGolden: Boolean(args.flags.golden)
    });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("corrections promote", args, true, JSON.stringify(result), [result.path], result.runId);
    return;
  }
  throw new Error("Usage: rax corrections list | promote <correction-id> --eval --training --golden");
}

async function trainCommand(args: ParsedArgs): Promise<void> {
  if (args.positional[0] === "quality") {
    const file = typeof args.flags.file === "string" ? args.flags.file : args.positional[1];
    if (!file) throw new Error("Usage: rax train quality --file training.jsonl");
    const result = await new TrainingQualityGate().checkFile(file);
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("train quality", args, result.passed, JSON.stringify(result), [file]);
    if (!result.passed) process.exitCode = 1;
    return;
  }
  if (args.positional[0] !== "export") {
    throw new Error("Usage: rax train export --sft | --preference | --all | rax train quality --file training.jsonl");
  }
  const exporter = new TrainingExporter();
  const results = [];
  if (args.flags.sft || args.flags.all) results.push(await exporter.exportSft());
  if (args.flags.preference || args.flags.all) results.push(await exporter.exportPreference());
  logInfo(JSON.stringify(results, null, 2));
  await recordCommandEvent("train export", args, true, JSON.stringify(results), results.map((item) => String(item)));
}

async function policyCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0];
  if (action === "list") {
    const entries = await fs.readdir("policies");
    logInfo(entries.filter((entry) => entry.endsWith(".md")).join("\n"));
    return;
  }
  if (action === "compile") {
    const mode = (typeof args.flags.mode === "string" ? args.flags.mode : "analysis") as RaxMode;
    const fileInput = typeof args.flags.file === "string" ? await fs.readFile(args.flags.file, "utf8") : args.positional.slice(1).join(" ");
    const risk = new RiskClassifier().score(fileInput);
    const boundary = new BoundaryDecision().decide(risk);
    const bundle = await new PolicyCompiler(new PolicyLoader(), new PolicySelector()).compile({
      mode,
      risk,
      boundaryMode: boundary.mode,
      userInput: fileInput,
      retrievedMemory: [],
      retrievedExamples: []
    });
    logInfo(bundle.compiledSystemPrompt);
    await recordCommandEvent("policy compile", args, true, bundle.compiledSystemPrompt);
    return;
  }
  throw new Error("Usage: rax policy list | compile --mode planning --file input.txt");
}

async function modeCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0];
  const registry = new ModeRegistry(process.cwd());
  if (action === "list") {
    const modes = await registry.list();
    logInfo(modes.map((entry) => `${entry.mode}\t${entry.maturity}`).join("\n"));
    return;
  }
  if (action === "inspect") {
    const mode = args.positional[1];
    if (!mode) throw new Error("Usage: rax mode inspect <mode>");
    const entry = await registry.inspect(mode);
    if (!entry) throw new Error(`Mode not found: ${mode}`);
    logInfo(JSON.stringify(entry, null, 2));
    return;
  }
  if (action === "maturity") {
    const report = await registry.maturity();
    logInfo(JSON.stringify(report, null, 2));
    return;
  }
  throw new Error("Usage: rax mode list | inspect <mode> | maturity");
}

async function chatCommand(args: ParsedArgs): Promise<void> {
  const runtime = await createDefaultRuntime();
  const session = new ChatSession(runtime, new MemoryStore(), process.cwd());
  const onceInput =
    typeof args.flags.once === "string"
      ? args.flags.once
      : args.positional.join(" ");

  if (onceInput.trim()) {
    const result = await session.handleLine(onceInput);
    if (result.output) logInfo(result.output);
    return;
  }

  if (!process.stdin.isTTY) {
    const raw = await new Promise<string>((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
    for (const line of raw.split(/\r?\n/)) {
      const result = await session.handleLine(line);
      if (result.output) logInfo(result.output);
      if (result.shouldExit) break;
    }
    return;
  }

  logInfo(await session.headerText());
  const rl = createInterface({ input, output });
  try {
    while (true) {
      const line = await rl.question("STAX> ");
      const result = await session.handleLine(line);
      if (result.output) logInfo(result.output);
      if (result.shouldExit) break;
    }
  } finally {
    rl.close();
  }
}

async function codexAuditLocalCommand(args: ParsedArgs): Promise<void> {
  const reportPath = typeof args.flags.report === "string" ? args.flags.report : args.positional[0];
  if (!reportPath) {
    throw new Error("Usage: rax codex-audit-local --report report.md");
  }
  const report = await fs.readFile(reportPath, "utf8");
  const evidence = await collectLocalEvidence(process.cwd(), {
    includeProjectDocs: false,
    includeModeMaturity: true
  });
  const runtime = await createDefaultRuntime();
  const inputText = [
    "Audit this Codex report against local read-only evidence.",
    "",
    "## Codex Report",
    report.trim(),
    "",
    formatLocalEvidence(evidence)
  ].join("\n");
  const result = await runtime.run(inputText, [], { mode: "codex_audit" });
  logInfo(result.output);
  logInfo("");
  logInfo(`Run: ${result.runId}`);
  logInfo(`Run folder: ${path.join("runs", result.createdAt.slice(0, 10), result.runId)}`);
}

async function traceCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  if (!runId) throw new Error("Usage: rax trace <run-id>");
  const runsDir = path.join(process.cwd(), "runs");
  for (const date of await fs.readdir(runsDir)) {
    const dateDir = path.join(runsDir, date);
    const dateStat = await fs.stat(dateDir);
    if (!dateStat.isDirectory()) continue;
    const candidate = path.join(runsDir, date, runId, "trace.json");
    try {
      logInfo(await fs.readFile(candidate, "utf8"));
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Trace not found: ${runId}`);
}

async function showCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0] === "last" || !args.positional[0]
    ? await latestRunId(process.cwd())
    : args.positional[0];
  const runDir = await findRunDir(process.cwd(), runId);
  const final = await fs.readFile(path.join(runDir, "final.md"), "utf8");
  const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
    mode?: string;
    validation?: { valid?: boolean };
    learningEventId?: string;
    learningQueues?: string[];
  };
  if (args.flags.summary) {
    logInfo([
      `Run: ${runId}`,
      `Mode: ${trace.mode ?? "unknown"}`,
      `Validation: ${trace.validation?.valid === false ? "failed" : "passed"}`,
      `LearningEvent: ${trace.learningEventId ?? "none"}`,
      `LearningQueues: ${trace.learningQueues?.join(", ") || "none"}`,
      `Trace: ${path.relative(process.cwd(), path.join(runDir, "trace.json"))}`
    ].join("\n"));
    return;
  }
  logInfo([
    final.trim(),
    "",
    `Run: ${runId}`,
    `Mode: ${trace.mode ?? "unknown"}`,
    `Validation: ${trace.validation?.valid === false ? "failed" : "passed"}`,
    `LearningEvent: ${trace.learningEventId ?? "none"}`,
    `LearningQueues: ${trace.learningQueues?.join(", ") || "none"}`,
    `Trace: ${path.relative(process.cwd(), path.join(runDir, "trace.json"))}`
  ].join("\n"));
}

async function evidenceCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "list";
  const collector = new EvidenceCollector();
  if (action === "collect") {
    const result = await collector.collect({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : "current"
    });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("evidence collect", args, true, JSON.stringify(result), [result.path]);
    return;
  }
  if (action === "list") {
    const collections = await collector.list();
    logInfo(JSON.stringify(collections, null, 2));
    await recordCommandEvent("evidence list", args, true, JSON.stringify({ count: collections.length }));
    return;
  }
  if (action === "show") {
    const id = args.positional[1];
    if (!id) throw new Error("Usage: rax evidence show <collection-id|evidence-id>");
    const collection = await collector.show(id);
    if (!collection) throw new Error(`Evidence not found: ${id}`);
    logInfo(JSON.stringify(collection, null, 2));
    await recordCommandEvent("evidence show", args, true, JSON.stringify(collection));
    return;
  }
  throw new Error("Usage: rax evidence collect [--workspace current] | list | show <id>");
}

async function workspaceCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "list";
  const store = new WorkspaceStore();
  if (action === "create") {
    const name = args.positional[1];
    const repo = typeof args.flags.repo === "string" ? args.flags.repo : "";
    if (!name || !repo) throw new Error("Usage: rax workspace create <name> --repo <path>");
    const record = await store.create({ workspace: name, repoPath: repo, use: Boolean(args.flags.use) });
    logInfo(JSON.stringify(record, null, 2));
    await recordCommandEvent("workspace create", args, true, JSON.stringify(record));
    return;
  }
  if (action === "use") {
    const name = args.positional[1];
    if (!name) throw new Error("Usage: rax workspace use <name>");
    const record = await store.use(name);
    logInfo(JSON.stringify(record, null, 2));
    await recordCommandEvent("workspace use", args, true, JSON.stringify(record));
    return;
  }
  if (action === "status" || action === "current") {
    logInfo(JSON.stringify(await store.status(), null, 2));
    return;
  }
  if (action === "show") {
    const name = args.positional[1];
    if (!name) throw new Error("Usage: rax workspace show <name>");
    const record = await store.get(name);
    if (!record) throw new Error(`Workspace not found: ${name}`);
    logInfo(JSON.stringify(record, null, 2));
    return;
  }
  if (action === "list") {
    logInfo(JSON.stringify(await store.list(), null, 2));
    return;
  }
  if (action === "repo-summary") {
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : "current",
      requireWorkspace: true
    });
    if (!workspace.linkedRepoPath) throw new Error(`Workspace has no linked repo path: ${workspace.workspace}`);
    logInfo((await new RepoSummary(workspace.linkedRepoPath).summarize()).markdown);
    return;
  }
  if (action === "search") {
    const query = args.positional.slice(1).join(" ");
    if (!query.trim()) throw new Error('Usage: rax workspace search "query"');
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : "current",
      requireWorkspace: true
    });
    if (!workspace.linkedRepoPath) throw new Error(`Workspace has no linked repo path: ${workspace.workspace}`);
    const search = new RepoSearch(workspace.linkedRepoPath);
    logInfo(search.format(await search.search(query), query));
    return;
  }
  throw new Error("Usage: rax workspace create <name> --repo <path> [--use] | use <name> | status | list | show <name> | repo-summary | search <query>");
}

async function disagreeCommand(args: ParsedArgs): Promise<void> {
  const reason = typeof args.flags.reason === "string" ? args.flags.reason : args.positional.join(" ");
  if (!reason.trim()) throw new Error("Usage: rax disagree --reason \"...\" [--run <run-id>] [--mode codex_audit]");
  const result = await new DisagreementCapture().capture({
    reason,
    lastRunId: typeof args.flags.run === "string" ? args.flags.run : undefined,
    mode: typeof args.flags.mode === "string" ? args.flags.mode : undefined
  });
  logInfo(JSON.stringify(result, null, 2));
}

async function compareCommand(args: ParsedArgs): Promise<void> {
  if (args.positional[0] === "import-baseline") {
    const file = typeof args.flags.file === "string" ? args.flags.file : undefined;
    if (!file) throw new Error("Usage: rax compare import-baseline --file external_baseline.json");
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    const importer = new ExternalBaselineImport();
    const result = importer.validate(parsed);
    logInfo(importer.format(result));
    await recordCommandEvent("compare import-baseline", args, result.externalBaselineValid, JSON.stringify(result), []);
    return;
  }
  if (args.positional[0] === "benchmark") {
    const benchmark = new LocalProblemBenchmark();
    const file = typeof args.flags.file === "string" ? args.flags.file : undefined;
    const dir = typeof args.flags.fixtures === "string" ? args.flags.fixtures : undefined;
    const summary = file
      ? await benchmark.scoreFile(file)
      : await benchmark.scoreDirectory(dir ?? "fixtures/problem_benchmark");
    logInfo(benchmark.formatSummary(summary));
    await recordCommandEvent("compare benchmark", args, summary.stopConditionMet, JSON.stringify(summary), []);
    return;
  }
  if (args.positional[0] === "adversary") {
    const file = typeof args.flags.file === "string" ? args.flags.file : undefined;
    if (!file) throw new Error("Usage: rax compare adversary --file fixture.json");
    const cases = await loadProblemBenchmarkCases(file);
    const adversary = new BenchmarkAdversary();
    const results = cases.map((item) => ({
      caseId: item.id,
      repo: item.repo,
      result: adversary.evaluate({
        task: item.task,
        localEvidence: item.localEvidence,
        cleanAnswer: item.staxAnswer
      })
    }));
    const failed = results.filter((item) => !item.result.passed);
    const outputText = formatAdversaryResults(results);
    logInfo(outputText);
    await recordCommandEvent("compare adversary", args, failed.length === 0, outputText, []);
    return;
  }
  const taskFile = typeof args.flags.task === "string" ? args.flags.task : undefined;
  const staxFile = typeof args.flags.stax === "string" ? args.flags.stax : undefined;
  const externalFile = typeof args.flags.external === "string" ? args.flags.external : undefined;
  if (!staxFile || !externalFile) {
    throw new Error("Usage: rax compare import-baseline --file external_baseline.json | rax compare benchmark [--fixtures dir|--file fixture.json] | rax compare adversary --file fixture.json | rax compare --stax stax-answer.md --external external-answer.md [--task task.md] [--evidence evidence.md]");
  }
  const task = taskFile ? await fs.readFile(taskFile, "utf8") : args.positional.join(" ") || "Compare answers for this STAX project.";
  const staxAnswer = await fs.readFile(staxFile, "utf8");
  const externalAnswer = await fs.readFile(externalFile, "utf8");
  const evidence = typeof args.flags.evidence === "string" ? await fs.readFile(args.flags.evidence, "utf8") : "";
  const runtime = await createDefaultRuntime();
  const result = await runtime.run(
    [
      "Compare these answers for local STAX project usefulness.",
      "",
      "## Task",
      task.trim(),
      "",
      "## STAX Answer",
      staxAnswer.trim(),
      "",
      "## External Answer",
      externalAnswer.trim(),
      "",
      "## Local Evidence",
      evidence.trim() || "No local evidence file supplied."
    ].join("\n"),
    [],
    { mode: "model_comparison" }
  );
  logInfo(result.output);
  logInfo("");
  logInfo(`Run: ${result.runId}`);
  await recordCommandEvent("compare", args, result.validation.valid, result.output, [
    path.join("runs", result.createdAt.slice(0, 10), result.runId)
  ], result.runId);
}

async function loadProblemBenchmarkCases(file: string): Promise<ProblemBenchmarkCase[]> {
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.map((item) => ProblemBenchmarkCaseSchema.parse(item));
  }
  const collection = ProblemBenchmarkCollectionSchema.parse(parsed);
  return collection.cases.map((item) => ProblemBenchmarkCaseSchema.parse({
    ...item,
    staxAnswerSource: item.staxAnswerSource ?? collection.staxAnswerSource,
    staxCapturedAt: item.staxCapturedAt ?? collection.staxCapturedAt,
    externalAnswerSource: item.externalAnswerSource ?? collection.externalAnswerSource,
    externalCapturedAt: item.externalCapturedAt ?? collection.externalCapturedAt,
    externalPrompt: item.externalPrompt ?? collection.externalPrompt,
    sourceType: item.sourceType ?? collection.sourceType,
    sourceId: item.sourceId ?? collection.sourceId,
    captureContext: item.captureContext ?? collection.captureContext,
    promptHash: item.promptHash ?? collection.promptHash,
    humanConfirmedNotDrifted: item.humanConfirmedNotDrifted ?? collection.humanConfirmedNotDrifted
  }));
}

function formatAdversaryResults(results: Array<{ caseId: string; repo: string; result: ReturnType<BenchmarkAdversary["evaluate"]> }>): string {
  const failed = results.filter((item) => !item.result.passed);
  return [
    "## Benchmark Adversary",
    `Total: ${results.length}`,
    `Passed: ${results.length - failed.length}`,
    `Failed: ${failed.length}`,
    "",
    "## Results",
    ...results.map((item) => [
      `- ${item.caseId} (${item.repo}): ${item.result.passed ? "passed" : "failed"}`,
      `  - CleanScore: ${item.result.cleanScore}`,
      `  - GarbageScore: ${item.result.garbageScore}`,
      item.result.blockingReasons.length ? `  - BlockingReasons: ${item.result.blockingReasons.join("; ")}` : undefined
    ].filter(Boolean).join("\n")),
    "",
    "## Gate",
    failed.length
      ? "Benchmark anti-gaming failed: at least one mutation or garbage answer scored too close to or above the clean answer."
      : "Benchmark anti-gaming passed: stuffed/generic/fake-evidence answers did not beat clean useful answers."
  ].join("\n");
}

async function superiorityCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "status";
  if (["status", "score", "campaign"].includes(action)) {
    const gate = new GeneralSuperiorityGate();
    const file = typeof args.flags.file === "string" ? args.flags.file : undefined;
    const dir = typeof args.flags.fixtures === "string" ? args.flags.fixtures : undefined;
    const report = file
      ? await gate.evaluateFile(file)
      : await gate.evaluateDirectory(dir ?? "fixtures/problem_benchmark");
    const outputText = gate.format(report);
    logInfo(outputText);
    await recordCommandEvent(`superiority ${action}`, args, report.status === "superiority_candidate", JSON.stringify(report), []);
    return;
  }
  if (action === "failures") {
    const gate = new GeneralSuperiorityGate();
    const file = typeof args.flags.file === "string" ? args.flags.file : undefined;
    const dir = typeof args.flags.fixtures === "string" ? args.flags.fixtures : undefined;
    const report = file
      ? await gate.evaluateFile(file)
      : await gate.evaluateDirectory(dir ?? "fixtures/problem_benchmark");
    const outputText = report.nonWinningCases.length
      ? report.nonWinningCases.map((item) => `${item.caseId} (${item.repo}): ${item.winner}`).join("\n")
      : "No non-winning cases.";
    logInfo(outputText);
    await recordCommandEvent("superiority failures", args, report.nonWinningCases.length === 0, outputText, []);
    return;
  }
  if (action === "prompt") {
    const outputText = generalSuperiorityExternalPrompt();
    logInfo(outputText);
    await recordCommandEvent("superiority prompt", args, true, outputText, []);
    return;
  }
  throw new Error("Usage: rax superiority status|score|campaign|failures|prompt [--fixtures dir|--file fixture.json]");
}

async function strategyCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "benchmark";
  if (action === "benchmark" || action === "score") {
    const benchmark = new StrategicBenchmark();
    const file = typeof args.flags.file === "string" ? args.flags.file : undefined;
    const dir = typeof args.flags.fixtures === "string" ? args.flags.fixtures : undefined;
    const summary = file ? await benchmark.scoreFile(file) : await benchmark.scoreDirectory(dir ?? "fixtures/strategy_benchmark");
    const outputText = benchmark.format(summary);
    logInfo(outputText);
    await recordCommandEvent(`strategy ${action}`, args, summary.status !== "not_proven", JSON.stringify(summary), []);
    return;
  }
  if (action === "prompt") {
    const outputText = strategicExternalPrompt();
    logInfo(outputText);
    await recordCommandEvent("strategy prompt", args, true, outputText, []);
    return;
  }
  throw new Error("Usage: rax strategy benchmark|score|prompt [--fixtures dir|--file fixture.json]");
}

async function autoAdvanceCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "";
  if (action === "sandbox") {
    const packetName = args.positional[1] ?? "brightspace-rollup";
    if (!["brightspace-rollup", "repair_rollup_install_integrity"].includes(packetName)) {
      throw new Error("Usage: rax auto-advance sandbox brightspace-rollup --sandbox-path <path> [--approve --create|--verify]");
    }
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
    });
    const packet = new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
      workspace: workspace.workspace,
      repoPath: workspace.linkedRepoPath
    });
    const sandboxPath = typeof args.flags["sandbox-path"] === "string" ? args.flags["sandbox-path"] : undefined;
    if (!sandboxPath) throw new Error("Usage: rax auto-advance sandbox brightspace-rollup --sandbox-path <path> [--approve --create|--verify]");
    const guard = new SandboxGuard();
    const result = args.flags.create === true
      ? await guard.create({
          workspace: workspace.workspace,
          packetId: packet.packetId,
          sourceRepoPath: workspace.linkedRepoPath,
          sandboxPath,
          humanApprovedSandbox: Boolean(args.flags.approve || args.flags["approved-sandbox"])
        })
      : await guard.verify({
          workspace: workspace.workspace,
          packetId: packet.packetId,
          sourceRepoPath: workspace.linkedRepoPath,
          sandboxPath
        });
    const stdout = JSON.stringify(result, null, 2);
    logInfo(stdout);
    await recordCommandEvent(`auto-advance sandbox ${args.flags.create === true ? "create" : "verify"}`, args, result.status === "created" || result.status === "verified", stdout, result.manifestPath ? [result.manifestPath] : [], undefined, workspace);
    if (result.status === "blocked" || result.status === "approval_required") process.exitCode = 1;
    return;
  }
  if (action === "patch-window") {
    const packetName = args.positional[1] ?? "brightspace-rollup";
    if (!["brightspace-rollup", "repair_rollup_install_integrity"].includes(packetName)) {
      throw new Error("Usage: rax auto-advance patch-window brightspace-rollup --sandbox-path <path> --file <allowed-file> [--content text|--content-file path] --approve");
    }
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
    });
    const packet = new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
      workspace: workspace.workspace,
      repoPath: workspace.linkedRepoPath
    });
    const sandboxPath = typeof args.flags["sandbox-path"] === "string" ? args.flags["sandbox-path"] : undefined;
    const filePath = typeof args.flags.file === "string" ? args.flags.file : undefined;
    const contentFile = typeof args.flags["content-file"] === "string" ? args.flags["content-file"] : undefined;
    const content = typeof args.flags.content === "string"
      ? args.flags.content
      : contentFile
        ? await fs.readFile(contentFile, "utf8")
        : undefined;
    if (!sandboxPath || !filePath || content === undefined) {
      throw new Error("Usage: rax auto-advance patch-window brightspace-rollup --sandbox-path <path> --file <allowed-file> [--content text|--content-file path] --approve");
    }
    if (!workspace.linkedRepoPath) throw new Error("Linked repo path is required before sandbox patching.");
    const result = await new SandboxPatchWindow().run({
      packet,
      operations: [{
        filePath,
        content,
        justification: typeof args.flags.justification === "string" ? args.flags.justification : undefined
      }],
      humanApprovedPatch: Boolean(args.flags.approve || args.flags["approved-patch"]),
      sandboxPath,
      linkedRepoPath: workspace.linkedRepoPath,
      workspace: workspace.workspace
    });
    const stdout = JSON.stringify(result, null, 2);
    logInfo(stdout);
    const evidenceArgs = typeof args.flags.content === "string"
      ? { ...args, flags: { ...args.flags, content: "[patch content omitted; see patch evidence diff]" } }
      : args;
    await recordCommandEvent("auto-advance patch-window", evidenceArgs, result.status === "patched", stdout, [result.diffPath, result.manifestPath].filter((item): item is string => Boolean(item)), undefined, workspace);
    if (result.status === "blocked" || result.status === "approval_required") process.exitCode = 1;
    return;
  }
  if (action === "command-window") {
    const packetName = args.positional[1] ?? "brightspace-rollup";
    if (!["brightspace-rollup", "repair_rollup_install_integrity"].includes(packetName)) {
      throw new Error("Usage: rax auto-advance command-window brightspace-rollup [--approve] [--execute --sandbox-path <path>] [--command <exact command>]");
    }
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
    });
    const packet = new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
      workspace: workspace.workspace,
      repoPath: workspace.linkedRepoPath
    });
    const commands = typeof args.flags.command === "string"
      ? [args.flags.command]
      : packet.allowedCommands;
    const completedCommands = [
      args.flags["completed-ls"] === true ? { command: "npm ls @rollup/rollup-darwin-arm64 rollup vite", exitCode: 0 } : undefined,
      args.flags["completed-build"] === true ? { command: "npm run build", exitCode: 0 } : undefined,
      args.flags["completed-ingest"] === true ? { command: "npm run ingest:ci", exitCode: 0 } : undefined
    ].filter((item): item is { command: string; exitCode: number } => Boolean(item));
    if (args.flags.execute === true) {
      const sandboxPath = typeof args.flags["sandbox-path"] === "string" ? args.flags["sandbox-path"] : undefined;
      if (!sandboxPath) throw new Error("Usage: rax auto-advance command-window brightspace-rollup --approve --execute --sandbox-path <path>");
      const sandbox = await new SandboxGuard().verify({
        workspace: workspace.workspace,
        packetId: packet.packetId,
        sourceRepoPath: workspace.linkedRepoPath,
        sandboxPath
      });
      if (!sandbox.allowedForCommandWindow) {
        const stdout = JSON.stringify({ sandbox, commandWindow: null }, null, 2);
        logInfo(stdout);
        await recordCommandEvent("auto-advance command-window", args, false, stdout, sandbox.manifestPath ? [sandbox.manifestPath] : [], undefined, workspace);
        process.exitCode = 1;
        return;
      }
    }
    const result = await new SandboxCommandWindow().run({
      packet,
      commands,
      humanApprovedWindow: Boolean(args.flags.approve || args.flags["approved-window"]),
      execute: Boolean(args.flags.execute),
      sandboxPath: typeof args.flags["sandbox-path"] === "string" ? args.flags["sandbox-path"] : undefined,
      linkedRepoPath: workspace.linkedRepoPath,
      workspace: workspace.workspace,
      completedCommands
    });
    const stdout = JSON.stringify(result, null, 2);
    logInfo(stdout);
    await recordCommandEvent("auto-advance command-window", args, result.status !== "blocked" && result.status !== "stopped", stdout, result.evidenceIds, undefined, workspace);
    if (result.status === "blocked" || result.status === "stopped") process.exitCode = 1;
    return;
  }
  if (action === "bootstrap") {
    const packetName = args.positional[1] ?? "brightspace-rollup";
    if (!["brightspace-rollup", "repair_rollup_install_integrity"].includes(packetName)) {
      throw new Error("Usage: rax auto-advance bootstrap brightspace-rollup --sandbox-path <path> [--approve --execute] [--repair-lockfile]");
    }
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
    });
    if (!workspace.linkedRepoPath) throw new Error("Linked repo path is required before sandbox dependency bootstrap.");
    const packet = new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
      workspace: workspace.workspace,
      repoPath: workspace.linkedRepoPath
    });
    const sandboxPath = typeof args.flags["sandbox-path"] === "string" ? args.flags["sandbox-path"] : undefined;
    if (!sandboxPath) throw new Error("Usage: rax auto-advance bootstrap brightspace-rollup --sandbox-path <path> [--approve --execute] [--repair-lockfile]");
    const result = await new SandboxDependencyBootstrap().run({
      packet,
      workspace: workspace.workspace,
      sandboxPath,
      linkedRepoPath: workspace.linkedRepoPath,
      humanApprovedBootstrap: Boolean(args.flags.approve || args.flags["approve-bootstrap"] || args.flags["approved-bootstrap"]),
      execute: Boolean(args.flags.execute),
      repairLockfile: Boolean(args.flags["repair-lockfile"]),
      commands: typeof args.flags.command === "string" ? [args.flags.command] : undefined
    });
    const stdout = JSON.stringify(result, null, 2);
    logInfo(stdout);
    await recordCommandEvent("auto-advance bootstrap", args, result.status === "bootstrapped" || result.status === "ready", stdout, result.evidenceIds, undefined, workspace);
    if (result.status === "blocked" || result.status === "stopped" || result.status === "approval_required") process.exitCode = 1;
    return;
  }
  if (action === "run-packet") {
    const packetName = args.positional[1] ?? "brightspace-rollup";
    if (!["brightspace-rollup", "repair_rollup_install_integrity"].includes(packetName)) {
      throw new Error("Usage: rax auto-advance run-packet brightspace-rollup --sandbox-path <path> [--approve-sandbox --approve-window] [--file <allowed-file> --content text|--content-file path]");
    }
    const workspace = await new WorkspaceContext().resolve({
      workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
    });
    if (!workspace.linkedRepoPath) throw new Error("Linked repo path is required before run-packet.");
    const packet = new WorkPacketPlanner().brightspaceRollupInstallIntegrityPacket({
      workspace: workspace.workspace,
      repoPath: workspace.linkedRepoPath
    });
    const sandboxPath = typeof args.flags["sandbox-path"] === "string" ? args.flags["sandbox-path"] : undefined;
    if (!sandboxPath) throw new Error("Usage: rax auto-advance run-packet brightspace-rollup --sandbox-path <path> [--approve-sandbox --approve-window]");
    const approveSandbox = Boolean(args.flags["approve-sandbox"] || args.flags["approved-sandbox"] || args.flags.approve);
    const approveWindow = Boolean(args.flags["approve-window"] || args.flags["approved-window"] || args.flags.approve);
    const approvePatch = Boolean(args.flags["approve-patch"] || args.flags["approved-patch"] || approveWindow);
    const dryRun = Boolean(args.flags["dry-run"]) || !approveWindow;
    const guard = new SandboxGuard();
    let sandbox = await guard.verify({
      workspace: workspace.workspace,
      packetId: packet.packetId,
      sourceRepoPath: workspace.linkedRepoPath,
      sandboxPath
    });
    if (!sandbox.allowedForCommandWindow && approveSandbox) {
      const exists = await fs.stat(sandboxPath).then((stat) => stat.isDirectory()).catch(() => false);
      sandbox = exists
        ? sandbox
        : await guard.create({
            workspace: workspace.workspace,
            packetId: packet.packetId,
            sourceRepoPath: workspace.linkedRepoPath,
            sandboxPath,
            humanApprovedSandbox: true
          });
      if (!sandbox.allowedForCommandWindow && sandbox.status !== "created") {
        sandbox = await guard.verify({
          workspace: workspace.workspace,
          packetId: packet.packetId,
          sourceRepoPath: workspace.linkedRepoPath,
          sandboxPath
        });
      }
    }

    const filePath = typeof args.flags.file === "string" ? args.flags.file : undefined;
    const contentFile = typeof args.flags["content-file"] === "string" ? args.flags["content-file"] : undefined;
    const content = typeof args.flags.content === "string"
      ? args.flags.content
      : contentFile
        ? await fs.readFile(contentFile, "utf8")
        : undefined;
    const operations = filePath && content !== undefined
      ? [{
          filePath,
          content,
          justification: typeof args.flags.justification === "string" ? args.flags.justification : undefined
        }]
      : [];
    const maxLoops = typeof args.flags["max-loops"] === "string" ? Number(args.flags["max-loops"]) : 100;
    const execute = !dryRun && sandbox.allowedForCommandWindow;
    const approveBootstrap = Boolean(args.flags["approve-bootstrap"] || args.flags["approved-bootstrap"] || args.flags.approve);
    const bootstrapResult = args.flags.bootstrap === true
      ? await new SandboxDependencyBootstrap().run({
          packet,
          workspace: workspace.workspace,
          sandboxPath,
          linkedRepoPath: workspace.linkedRepoPath,
          humanApprovedBootstrap: approveBootstrap,
          execute: execute && approveBootstrap,
          repairLockfile: Boolean(args.flags["repair-lockfile"])
        })
      : undefined;
    if (bootstrapResult && !["bootstrapped", "ready"].includes(bootstrapResult.status)) {
      const stdout = JSON.stringify({ sandbox, bootstrap: bootstrapResult, loop: null }, null, 2);
      logInfo(stdout);
      await recordCommandEvent("auto-advance run-packet", args, false, stdout, [
        sandbox.manifestPath,
        ...bootstrapResult.evidenceIds
      ].filter((item): item is string => Boolean(item)), undefined, workspace);
      process.exitCode = 1;
      return;
    }
    const result = await new SandboxLoopRunner().run({
      packet,
      mode: dryRun ? "dry_run" : operations.length ? "sandbox_patch" : "sandbox_commands",
      workspace: workspace.workspace,
      sandboxPath,
      linkedRepoPath: workspace.linkedRepoPath,
      humanApprovedPatch: approvePatch,
      humanApprovedCommandWindow: approveWindow,
      execute,
      operations,
      commands: typeof args.flags.command === "string" ? [args.flags.command] : undefined,
      budget: { maxLoops: Number.isFinite(maxLoops) && maxLoops > 0 ? maxLoops : 100 }
    });
    const stdout = JSON.stringify({ sandbox, bootstrap: bootstrapResult, loop: result }, null, 2);
    logInfo(stdout);
    const evidenceArgs = typeof args.flags.content === "string"
      ? { ...args, flags: { ...args.flags, content: "[patch content omitted; see patch evidence diff]" } }
      : args;
    await recordCommandEvent("auto-advance run-packet", evidenceArgs, result.status !== "blocked", stdout, [
      sandbox.manifestPath,
      ...(bootstrapResult?.evidenceIds ?? []),
      result.chainResult?.patchDiffPath,
      ...(result.chainResult?.evidenceIds ?? [])
    ].filter((item): item is string => Boolean(item)), undefined, workspace);
    if (result.status === "blocked") process.exitCode = 1;
    return;
  }
  throw new Error("Usage: rax auto-advance sandbox|patch-window|command-window|bootstrap|run-packet brightspace-rollup ...");
}

function strategicExternalPrompt(): string {
  return [
    "You are the external baseline for a STAX broad strategic reasoning benchmark.",
    "",
    "Answer using ONLY the supplied task and context.",
    "Do not drift into repo-proof mechanics unless the task asks about repo proof.",
    "Give one strategic decision, not a long roadmap.",
    "Include the option you choose, why it beats alternatives, the biggest tradeoff, one next proof step, and one kill criterion.",
    "Do not claim certainty if the evidence is missing.",
    "Return 4-8 sentences."
  ].join("\n");
}

async function mineCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "report";
  const miner = new BehaviorMiner();

  if (action === "prompt") {
    logInfo(miner.safePrompt());
    return;
  }

  if (action === "report" || action === "saturation") {
    const windowSize = typeof args.flags.window === "string" ? Number(args.flags.window) : 3;
    const report = await miner.report(Number.isFinite(windowSize) && windowSize > 0 ? windowSize : 3);
    logInfo(miner.formatReport(report));
    return;
  }

  if (action === "requirements") {
    const requirements = await miner.readRequirements();
    logInfo(JSON.stringify(requirements, null, 2));
    return;
  }

  if (action === "triage" || action === "next") {
    const requirements = await miner.readRequirements();
    const triage = new BehaviorRequirementTriage();
    const report = await triage.triage(requirements, { write: args.flags.write === true });
    logInfo(triage.format(report, {
      limit: typeof args.flags.limit === "string" ? Number(args.flags.limit) : undefined
    }));
    return;
  }

  if (action === "round") {
    const staxFile = typeof args.flags.stax === "string" ? args.flags.stax : undefined;
    const externalFile = typeof args.flags.external === "string" ? args.flags.external : undefined;
    if (!staxFile || !externalFile) {
      throw new Error("Usage: rax mine round --stax stax-answer.md --external external-answer.md [--task task.md|text] [--evidence evidence.md] [--source chatgpt-stax]");
    }
    const task = typeof args.flags.task === "string"
      ? await readFileOrLiteral(args.flags.task)
      : args.positional.slice(1).join(" ") || "Mine observable behavior from an external STAX-like assistant.";
    const staxAnswer = await fs.readFile(staxFile, "utf8");
    const externalAnswer = await fs.readFile(externalFile, "utf8");
    const localEvidence = typeof args.flags.evidence === "string" ? await fs.readFile(args.flags.evidence, "utf8") : "";
    const result = await miner.recordRound({
      task,
      staxAnswer,
      externalAnswer,
      localEvidence,
      sourceSystem: typeof args.flags.source === "string" ? args.flags.source : "chatgpt-stax",
      staxAnswerPath: staxFile,
      externalAnswerPath: externalFile,
      evidencePath: typeof args.flags.evidence === "string" ? args.flags.evidence : undefined
    });
    logInfo(miner.formatRound(result.round, result.report));
    await recordCommandEvent("mine round", args, true, JSON.stringify(result.round), [result.path, result.report.latestReportPath ?? "learning/extraction/latest_report.json"]);
    return;
  }

  throw new Error("Usage: rax mine prompt|round|report|saturation|requirements|triage|next");
}

async function reviewCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0] ?? "inbox";
  const router = new ReviewRouter();
  const queue = new ReviewQueue();
  const ledger = new ReviewLedger();
  if (action === "route") {
    const sourceId = args.positional[1];
    if (!sourceId) throw new Error("Usage: rax review route <source-id> [--apply]");
    const result = await router.routeSourceId(sourceId, { apply: Boolean(args.flags.apply) });
    logInfo(JSON.stringify(result, null, 2));
    return;
  }
  if (action === "inbox" || action === "digest" || action === "staged" || action === "blocked" || action === "all") {
    await router.refresh({ apply: true });
    const disposition = action === "staged"
      ? "auto_stage_for_review"
      : action === "blocked"
        ? "hard_block"
        : typeof args.flags.disposition === "string"
          ? ReviewDispositionSchema.parse(args.flags.disposition)
          : undefined;
    const risk = typeof args.flags.risk === "string" ? ReviewRiskLevelSchema.parse(args.flags.risk) : undefined;
    const workspace = typeof args.flags.workspace === "string" ? args.flags.workspace : undefined;
    const records = await queue.list({ workspace, disposition, risk, includeAuto: Boolean(args.flags.all) || action === "all" || action === "staged" });
    const title = action === "digest" ? "Review Digest" : action === "staged" ? "Auto-Staged Review Items" : action === "blocked" ? "Blocked Review Items" : "Review Inbox";
    logInfo(queue.formatInbox(records, title));
    return;
  }
  if (action === "show") {
    const reviewId = args.positional[1];
    if (!reviewId) throw new Error("Usage: rax review show <review-id>");
    const record = await ledger.get(reviewId);
    if (!record) throw new Error(`Review item not found: ${reviewId}`);
    logInfo(JSON.stringify(record, null, 2));
    return;
  }
  if (action === "batch") {
    await router.refresh({ apply: true });
    const workspace = typeof args.flags.workspace === "string" ? args.flags.workspace : undefined;
    const batch = await new ReviewBatcher().create({ workspace });
    logInfo(batch.markdown);
    return;
  }
  if (action === "ledger") {
    const source = typeof args.flags.source === "string" ? args.flags.source : undefined;
    logInfo(JSON.stringify(source ? await ledger.bySource(source) : await ledger.list(), null, 2));
    return;
  }
  if (action === "stats" || action === "metrics") {
    await router.refresh({ apply: true });
    logInfo(JSON.stringify(await new ReviewStatsStore().update(), null, 2));
    return;
  }
  if (action === "archive" || action === "reject" || action === "escalate") {
    const reviewId = args.positional[1];
    const reason = typeof args.flags.reason === "string" ? args.flags.reason : "";
    if (!reviewId) throw new Error(`Usage: rax review ${action} <review-id> --reason "..."`);
    const state = action === "archive" ? "archived" : action === "reject" ? "rejected" : "escalated";
    const record = await ledger.transition(reviewId, state, reason);
    await queue.write(record);
    logInfo(JSON.stringify(record, null, 2));
    return;
  }
  throw new Error("Usage: rax review route|inbox|digest|staged|blocked|all|show|batch|ledger|stats|archive|reject|escalate");
}

async function learnCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0];
  const queue = new LearningQueue();
  if (action === "queue") {
    const type = typeof args.flags.type === "string" ? LearningQueueTypeSchema.parse(args.flags.type) : undefined;
    const items = await queue.list(type);
    logInfo(items.length ? JSON.stringify(items, null, 2) : "[]");
    return;
  }
  if (action === "inspect") {
    const eventId = args.positional[1];
    if (!eventId) throw new Error("Usage: rax learn inspect <event-id>");
    logInfo(await fs.readFile(path.join("learning", "events", "hot", `${eventId}.json`), "utf8"));
    return;
  }
  if (action === "event") {
    const runId = args.positional[1];
    if (!runId) throw new Error("Usage: rax learn event <run-id>");
    const runDir = await findRunDir(process.cwd(), runId);
    logInfo(await fs.readFile(path.join(runDir, "learning_event.json"), "utf8"));
    return;
  }
  if (action === "propose") {
    const runId = args.positional[1] === "last" || !args.positional[1]
      ? await latestRunId(process.cwd())
      : args.positional[1];
    const runDir = await findRunDir(process.cwd(), runId);
    const event = LearningEventSchema.parse(JSON.parse(await fs.readFile(path.join(runDir, "learning_event.json"), "utf8")));
    const proposal = await new LearningProposalGenerator().generate(event);
    await recordCommandEvent("learn propose", args, true, JSON.stringify(proposal ?? { status: "trace_only" }), proposal ? [proposal.path] : [], runId);
    logInfo(proposal ? JSON.stringify(proposal, null, 2) : "No proposal needed for trace-only event.");
    return;
  }
  if (action === "promote") {
    const eventId = args.positional[1];
    if (!eventId) throw new Error("Usage: rax learn promote <event-id> --eval|--correction|--memory|--training --reason \"...\"");
    const target = promotionTarget(args);
    const reason = typeof args.flags.reason === "string" ? args.flags.reason : "";
    let result;
    try {
      result = await new PromotionGate().promote({
        eventId,
        target,
        reason,
        approveMemory: Boolean(args.flags["approve-memory"])
      });
      await recordCommandEvent("learn promote", args, true, JSON.stringify(result), [result.targetArtifactPath], result.sourceRunId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordCommandEvent("learn promote", args, false, message);
      throw error;
    }
    logInfo(JSON.stringify(result, null, 2));
    return;
  }
  if (action === "reject") {
    const eventId = args.positional[1];
    const reason = typeof args.flags.reason === "string" ? args.flags.reason : "";
    if (!eventId) throw new Error("Usage: rax learn reject <event-id> --reason \"...\"");
    logInfo(JSON.stringify(await queue.reject(eventId, reason), null, 2));
    return;
  }
  if (action === "metrics") {
    logInfo(JSON.stringify(await new LearningMetricsStore().read(), null, 2));
    return;
  }
  if (action === "failures") {
    const mode = typeof args.flags.mode === "string" ? args.flags.mode : undefined;
    const events = await learningEvents();
    const failed = events.filter((event) => event.failureClassification.hasFailure && (!mode || event.output.mode === mode));
    logInfo(JSON.stringify(failed, null, 2));
    return;
  }
  if (action === "repeated") {
    const events = await learningEvents();
    const counts = new Map<string, number>();
    for (const event of events) {
      for (const failure of event.failureClassification.failureTypes) {
        const key = `${event.output.mode}:${failure}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    logInfo(JSON.stringify(Array.from(counts.entries()).filter(([, count]) => count > 1), null, 2));
    return;
  }
  if (action === "retention") {
    const result = await new LearningRetention().run({
      apply: Boolean(args.flags.apply),
      reason: typeof args.flags.reason === "string" ? args.flags.reason : undefined
    });
    logInfo(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error("Usage: rax learn queue|inspect|event|propose|promote|reject|metrics|failures|repeated|retention");
}

async function labCommand(args: ParsedArgs): Promise<void> {
  const action = args.positional[0];
  if (action === "go") {
    const profile = typeof args.flags.profile === "string" ? args.flags.profile : "cautious";
    const cycles = Number(typeof args.flags.cycles === "string" ? args.flags.cycles : "1");
    const domain = typeof args.flags.domain === "string" ? args.flags.domain : "planning";
    const count = Number(typeof args.flags.count === "string" ? args.flags.count : "5");
    const result = await new LabOrchestrator().go({
      profile,
      cycles,
      domain,
      count,
      executeVerification: Boolean(args.flags["execute-verification"])
    });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab go", args, true, JSON.stringify(result), [result.path]);
    return;
  }
  if (action === "curriculum") {
    const domain = typeof args.flags.domain === "string" ? args.flags.domain : "";
    const count = Number(typeof args.flags.count === "string" ? args.flags.count : "25");
    const result = await new CurriculumWorker().generate({ domain, count });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab curriculum", args, true, JSON.stringify(result.workerResult), [result.path]);
    return;
  }
  if (action === "scenarios") {
    const curriculumPath = typeof args.flags.curriculum === "string" ? args.flags.curriculum : "";
    if (!curriculumPath) throw new Error("Usage: rax lab scenarios --curriculum <file>");
    const result = await new ScenarioGenerator().generate({ curriculumPath });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab scenarios", args, true, JSON.stringify(result.workerResult), [result.path]);
    return;
  }
  if (action === "redteam") {
    const count = Number(typeof args.flags.count === "string" ? args.flags.count : "25");
    const result = await new RedTeamGenerator().generate({ count });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab redteam", args, true, JSON.stringify(result.workerResult), [result.path]);
    return;
  }
  if (action === "run") {
    const file = typeof args.flags.file === "string" ? args.flags.file : "";
    if (!file) throw new Error("Usage: rax lab run --file <scenario-file>");
    const result = await new LabRunner().runFile({ file });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab run", args, true, JSON.stringify(result.record), [result.path]);
    return;
  }
  if (action === "report") {
    const report = await new LabMetrics().report();
    logInfo(JSON.stringify(report, null, 2));
    await recordCommandEvent("lab report", args, true, JSON.stringify(report), ["learning/lab/reports/latest.json"]);
    return;
  }
  if (action === "queue") {
    const summary = await new LabMetrics().queueSummary();
    logInfo(summary);
    await recordCommandEvent("lab queue", args, true, summary);
    return;
  }
  if (action === "failures") {
    const result = await new FailureMiner().mine();
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab failures", args, true, JSON.stringify(result), [result.path]);
    return;
  }
  if (action === "patches") {
    const clusters = await new FailureMiner().readLatest();
    const proposals = await new PatchPlanner().plan({ clusters });
    logInfo(JSON.stringify(proposals, null, 2));
    await recordCommandEvent("lab patches", args, true, JSON.stringify(proposals), proposals.flatMap((item) => [item.path, item.markdownPath]));
    return;
  }
  if (action === "handoffs") {
    const patchFiles = await latestPatchFiles(process.cwd());
    const handoffs = [];
    for (const patchFile of patchFiles) {
      handoffs.push(await new CodexHandoffWorker().create({ patch: patchFile }));
    }
    logInfo(JSON.stringify(handoffs, null, 2));
    await recordCommandEvent("lab handoffs", args, true, JSON.stringify(handoffs), handoffs.map((item) => item.path));
    return;
  }
  if (action === "verify") {
    const patchId = args.positional[1];
    if (!patchId) throw new Error("Usage: rax lab verify <patch-id>");
    const result = await new VerificationWorker().verify({
      patchId,
      commands: ["npm run typecheck"],
      execute: Boolean(args.flags.execute)
    });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab verify", args, result.result.passed, JSON.stringify(result), [result.path]);
    return;
  }
  if (action === "gate") {
    const patchId = args.positional[1];
    if (!patchId) throw new Error("Usage: rax lab gate <patch-id>");
    const patchFile = await findPatchFile(process.cwd(), patchId);
    const result = await new ReleaseGate().evaluate({ patch: patchFile });
    logInfo(JSON.stringify(result, null, 2));
    await recordCommandEvent("lab gate", args, true, JSON.stringify(result), [result.path]);
    return;
  }
  throw new Error(
    "Usage: rax lab go|curriculum|scenarios|redteam|run|report|queue|failures|patches|handoffs|verify|gate"
  );
}

function promotionTarget(args: ParsedArgs): PromotionTarget {
  if (args.flags.eval) return "eval";
  if (args.flags.correction) return "correction";
  if (args.flags.memory) return "memory";
  if (args.flags.training) return "training";
  if (args.flags.policy_patch || args.flags.policy) return "policy_patch";
  if (args.flags.schema_patch || args.flags.schema) return "schema_patch";
  if (args.flags.mode_contract_patch || args.flags.mode) return "mode_contract_patch";
  if (args.flags.golden) return "golden";
  throw new Error("Promotion target required: --eval, --correction, --memory, --training, --policy, --schema, --mode, or --golden.");
}

async function learningEvents() {
  const dir = path.join(process.cwd(), "learning", "events", "hot");
  const events = [];
  try {
    for (const entry of await fs.readdir(dir)) {
      if (!entry.endsWith(".json")) continue;
      events.push(LearningEventSchema.parse(JSON.parse(await fs.readFile(path.join(dir, entry), "utf8"))));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return events;
}

async function latestPatchFiles(rootDir: string): Promise<string[]> {
  const dir = path.join(rootDir, "learning", "lab", "patches");
  try {
    const files = (await fs.readdir(dir))
      .filter((entry) => entry.endsWith(".json"))
      .sort()
      .slice(-10)
      .map((entry) => path.join("learning", "lab", "patches", entry));
    if (files.length === 0) throw new Error("No lab patch proposals found.");
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("No lab patch proposals found.");
    throw error;
  }
}

async function findPatchFile(rootDir: string, patchId: string): Promise<string> {
  const dir = path.join(rootDir, "learning", "lab", "patches");
  const direct = path.join(dir, `${patchId}.json`);
  try {
    await fs.stat(direct);
    return path.join("learning", "lab", "patches", `${patchId}.json`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const entry of await fs.readdir(dir)) {
    if (entry.endsWith(".json") && entry.includes(patchId)) {
      return path.join("learning", "lab", "patches", entry);
    }
  }
  throw new Error(`Lab patch proposal not found: ${patchId}`);
}

async function latestRunId(rootDir: string): Promise<string> {
  const runsDir = path.join(rootDir, "runs");
  let latest: { runId: string; mtime: number } | undefined;
  for (const date of await fs.readdir(runsDir)) {
    const dateDir = path.join(runsDir, date);
    const stat = await fs.stat(dateDir);
    if (!stat.isDirectory()) continue;
    for (const runId of await fs.readdir(dateDir)) {
      const runDir = path.join(dateDir, runId);
      const runStat = await fs.stat(runDir);
      if (!runStat.isDirectory()) continue;
      if (!latest || runStat.mtimeMs > latest.mtime) latest = { runId, mtime: runStat.mtimeMs };
    }
  }
  if (!latest) throw new Error("No runs found.");
  return latest.runId;
}

async function findRunDir(rootDir: string, runId: string): Promise<string> {
  const runsDir = path.join(rootDir, "runs");
  for (const date of (await fs.readdir(runsDir)).sort().reverse()) {
    const dateDir = path.join(runsDir, date);
    const dateStat = await fs.stat(dateDir);
    if (!dateStat.isDirectory()) continue;
    const candidate = path.join(runsDir, date, runId);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Run not found: ${runId}`);
}

async function recordCommandEvent(
  commandName: string,
  args: ParsedArgs,
  success: boolean,
  outputSummary: string,
  artifactPaths: string[] = [],
  runId?: string,
  workspace?: ResolvedWorkspaceContext
): Promise<void> {
  const resolved = workspace ?? await new WorkspaceContext().resolve({
    workspace: typeof args.flags.workspace === "string" ? args.flags.workspace : undefined
  });
  await new LearningRecorder().recordCommand({
    commandName,
    argsSummary: [args.command, ...args.positional].join(" "),
    success,
    outputSummary,
    exitStatus: success ? 0 : 1,
    artifactPaths,
    runId,
    workspace: resolved.workspace
  });
}

async function recordCommandEvidence(
  command: string,
  args: ParsedArgs,
  exitCode: number,
  stdout: string,
  stderr: string,
  summary: string,
  workspace?: ResolvedWorkspaceContext
) {
  return new CommandEvidenceStore().record({
    command,
    args: args.positional,
    exitCode,
    stdout,
    stderr,
    summary,
    workspace: workspace?.workspace,
    linkedRepoPath: workspace?.linkedRepoPath
  });
}

function commandLineFor(args: ParsedArgs): string {
  const flags = Object.entries(args.flags).flatMap(([key, value]) => value === true ? [`--${key}`] : [`--${key}`, String(value)]);
  return ["npm", "run", "rax", "--", args.command, ...args.positional, ...flags].join(" ");
}

function evalSummary(folder: string, result: { total: number; passed: number; failed: number; criticalFailures: number }): string {
  return `${folder} evals: ${result.passed}/${result.total} passed, failed=${result.failed}, criticalFailures=${result.criticalFailures}.`;
}

function commandEvidencePath(evidence: { commandEvidenceId: string; createdAt: string }): string {
  return path.join("evidence", "commands", evidence.createdAt.slice(0, 10), `${evidence.commandEvidenceId}.json`);
}

function help(): void {
  logInfo([
    "RAX commands:",
    '  rax run "input"',
    "  rax run --file input.txt",
    "  rax control-audit --case fixtures/control_audits/wrong_repo_command_evidence.json [--case-id <id>] [--print json]",
    "  rax batch folder/",
    "  rax doctor [--workspace <name>] [--print json]",
    "  rax eval [--mode stax_fitness] [--redteam] [--regression]",
    "  rax replay <run-id>",
    '  rax memory search "query" | list | approve <id> | reject <id>',
    '  rax correct <run-id> --file corrected.md --reason "..."',
    "  rax corrections list",
    "  rax corrections promote <correction-id> --eval --training --golden",
    "  rax train export --sft | --preference | --all",
    "  rax train quality --file training.jsonl",
    "  rax policy list",
    "  rax policy compile --mode planning --file input.txt",
    "  rax mode list | inspect <mode> | maturity",
    "  rax chat [--once \"message\"]",
    "  rax codex-audit-local --report report.md",
    "  rax trace <run-id>",
    "  rax show <run-id>|last [--summary]",
    "  rax learn queue|inspect|event|propose|promote|reject|metrics|failures|repeated",
    "  rax lab go|curriculum|scenarios|redteam|run|report|queue|failures|patches|handoffs|verify|gate",
    "  rax evidence collect|list|show <id>",
    "  rax workspace create <name> --repo <path> [--use] | use <name> | status | list | show <name> | repo-summary | search <query>",
    "  rax disagree --reason \"...\" [--run <run-id>]",
    "  rax compare --stax stax.md --external chatgpt.md [--task task.md]",
    "  rax compare benchmark [--fixtures fixtures/problem_benchmark | --file fixture.json]",
    "  rax compare adversary --file fixture.json",
    "  rax compare import-baseline --file external_baseline.json",
    "  rax superiority status|score|campaign|failures|prompt [--fixtures dir|--file fixture.json]",
    "  rax strategy benchmark|score|prompt [--fixtures dir|--file fixture.json]",
    "  rax auto-advance sandbox brightspace-rollup --sandbox-path <path> [--approve --create|--verify]",
    "  rax auto-advance patch-window brightspace-rollup --sandbox-path <path> --file <allowed-file> [--content text|--content-file path] --approve",
    "  rax auto-advance command-window brightspace-rollup [--approve] [--execute --sandbox-path <path>] [--command <exact command>]",
    "  rax auto-advance bootstrap brightspace-rollup --sandbox-path <path> [--approve --execute] [--repair-lockfile]",
    "  rax auto-advance run-packet brightspace-rollup --sandbox-path <path> [--approve-sandbox --approve-window] [--bootstrap --approve-bootstrap] [--file <allowed-file> --content text|--content-file path]",
    "  rax mine prompt|round|report|requirements|triage|next",
    "  rax review route|inbox|digest|staged|blocked|all|show|batch|ledger|stats"
  ].join("\n"));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const executable = path.basename(process.argv[1] ?? "");
  if (args.command === "run" && process.argv.slice(2).length === 0 && executable.includes("stax")) {
    await chatCommand({ command: "chat", positional: [], flags: {} });
  } else if (args.command === "run") {
    await runCommand(args);
  } else if (args.command === "control-audit") {
    await controlAuditCommand(args);
  } else if (args.command === "batch") {
    await batchCommand(args);
  } else if (args.command === "doctor") {
    await doctorCommand(args);
  } else if (args.command === "eval") {
    await evalCommand(args);
  } else if (args.command === "replay") {
    await replayCommand(args);
  } else if (args.command === "memory") {
    await memoryCommand(args);
  } else if (args.command === "correct") {
    await correctCommand(args);
  } else if (args.command === "corrections") {
    await correctionsCommand(args);
  } else if (args.command === "train") {
    await trainCommand(args);
  } else if (args.command === "policy") {
    await policyCommand(args);
  } else if (args.command === "mode") {
    await modeCommand(args);
  } else if (args.command === "chat") {
    await chatCommand(args);
  } else if (args.command === "codex-audit-local") {
    await codexAuditLocalCommand(args);
  } else if (args.command === "trace") {
    await traceCommand(args);
  } else if (args.command === "show") {
    await showCommand(args);
  } else if (args.command === "learn") {
    await learnCommand(args);
  } else if (args.command === "lab") {
    await labCommand(args);
  } else if (args.command === "evidence") {
    await evidenceCommand(args);
  } else if (args.command === "workspace") {
    await workspaceCommand(args);
  } else if (args.command === "disagree") {
    await disagreeCommand(args);
  } else if (args.command === "compare") {
    await compareCommand(args);
  } else if (args.command === "superiority") {
    await superiorityCommand(args);
  } else if (args.command === "strategy") {
    await strategyCommand(args);
  } else if (args.command === "auto-advance") {
    await autoAdvanceCommand(args);
  } else if (args.command === "mine") {
    await mineCommand(args);
  } else if (args.command === "review") {
    await reviewCommand(args);
  } else {
    help();
  }
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function generalSuperiorityExternalPrompt(): string {
  return [
    "You are the external baseline for a STAX general superiority campaign.",
    "",
    "Answer the task using ONLY the supplied evidence/context.",
    "Do not drift into STAX architecture advice unless the task is about STAX.",
    "Give a direct answer and one concrete next proof/action step.",
    "Do not claim tests pass, builds pass, deployment works, or fixes are complete unless supplied evidence includes command output proving it.",
    "If evidence is missing, say exactly what evidence is missing.",
    "Return 2-4 sentences only.",
    "",
    "The benchmark is blind: STAX must answer before this external answer is captured."
  ].join("\n");
}

async function readFileOrLiteral(value: string): Promise<string> {
  try {
    const stat = await fs.stat(value);
    if (stat.isFile()) return fs.readFile(value, "utf8");
  } catch {
    // Treat non-file values as literal task text.
  }
  return value;
}
