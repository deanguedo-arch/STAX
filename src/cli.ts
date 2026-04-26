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
import { collectLocalEvidence, formatLocalEvidence } from "./evidence/LocalEvidenceCollector.js";
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
import { createRunId } from "./utils/ids.js";
import { logError, logInfo } from "./utils/logger.js";

type ParsedArgs = {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
};

const knownCommands = new Set([
  "run",
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
  const output = await runtime.run(input, [], {
    mode: typeof args.flags.mode === "string" ? (args.flags.mode as RaxMode) : undefined,
    detailLevel:
      typeof args.flags.detail === "string"
        ? (args.flags.detail as DetailLevel)
        : undefined
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

async function batchCommand(args: ParsedArgs): Promise<void> {
  const folder = args.positional[0];
  if (!folder) {
    throw new Error("Usage: rax batch <folder>");
  }

  const runtime = await createDefaultRuntime();
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
        mode: typeof args.flags.mode === "string" ? (args.flags.mode as RaxMode) : undefined
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
  const result = await runEvals({
    folder,
    mode: typeof args.flags.mode === "string" ? args.flags.mode : undefined
  });
  logInfo(JSON.stringify(result, null, 2));
  await recordCommandEvent("eval", args, result.failed === 0 && result.criticalFailures === 0, JSON.stringify(result));
  if (result.failed > 0 || result.criticalFailures > 0 || result.passRate < DEFAULT_CONFIG.evals.minimumPassRate) {
    process.exitCode = 1;
  }
}

async function replayCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  const date = typeof args.flags.date === "string" ? args.flags.date : undefined;
  if (!runId) {
    throw new Error("Usage: rax replay <run-id>");
  }
  const result = await replayRun({ runId, date });
  logInfo(JSON.stringify(result, null, 2));
  await recordCommandEvent("replay", args, result.exact, JSON.stringify(result), [result.replayRunId]);
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
    logInfo(JSON.stringify(await store.approve(args.positional[1] ?? ""), null, 2));
    return;
  }
  if (action === "reject") {
    logInfo(JSON.stringify(await store.reject(args.positional[1] ?? ""), null, 2));
    return;
  }
  throw new Error('Usage: rax memory search "query" | list | approve <id> | reject <id>');
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
  if (args.positional[0] !== "export") {
    throw new Error("Usage: rax train export --sft | --preference | --all");
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
  runId?: string
): Promise<void> {
  await new LearningRecorder().recordCommand({
    commandName,
    argsSummary: [args.command, ...args.positional].join(" "),
    success,
    outputSummary,
    exitStatus: success ? 0 : 1,
    artifactPaths,
    runId
  });
}

function help(): void {
  logInfo([
    "RAX commands:",
    '  rax run "input"',
    "  rax run --file input.txt",
    "  rax batch folder/",
    "  rax eval [--mode stax_fitness] [--redteam] [--regression]",
    "  rax replay <run-id>",
    '  rax memory search "query" | list | approve <id> | reject <id>',
    '  rax correct <run-id> --file corrected.md --reason "..."',
    "  rax corrections list",
    "  rax corrections promote <correction-id> --eval --training --golden",
    "  rax train export --sft | --preference | --all",
    "  rax policy list",
    "  rax policy compile --mode planning --file input.txt",
    "  rax mode list | inspect <mode> | maturity",
    "  rax chat [--once \"message\"]",
    "  rax codex-audit-local --report report.md",
    "  rax trace <run-id>",
    "  rax show <run-id>|last [--summary]",
    "  rax learn queue|inspect|event|propose|promote|reject|metrics|failures|repeated",
    "  rax lab go|curriculum|scenarios|redteam|run|report|queue|failures|patches|handoffs|verify|gate"
  ].join("\n"));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const executable = path.basename(process.argv[1] ?? "");
  if (args.command === "run" && process.argv.slice(2).length === 0 && executable.includes("stax")) {
    await chatCommand({ command: "chat", positional: [], flags: {} });
  } else if (args.command === "run") {
    await runCommand(args);
  } else if (args.command === "batch") {
    await batchCommand(args);
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
  } else {
    help();
  }
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
