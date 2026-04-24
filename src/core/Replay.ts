import fs from "node:fs/promises";
import path from "node:path";
import type { RaxConfig } from "../schemas/Config.js";
import { createDefaultRuntime } from "./RaxRuntime.js";

export type ReplayInput = {
  rootDir?: string;
  date?: string;
  runId: string;
};

export type ReplayResult = {
  originalRunId: string;
  replayRunId: string;
  runId: string;
  date: string;
  provider: string;
  originalOutput: string;
  replayedOutput: string;
  exact: boolean;
  outputExact: boolean;
  traceExact: boolean;
  outputDiffSummary: string;
  traceDiffSummary: string;
  reason?: string;
};

export async function findRunDate(rootDir: string, runId: string): Promise<string> {
  const runsDir = path.join(rootDir, "runs");
  const dates = await fs.readdir(runsDir);
  for (const date of dates) {
    const candidate = path.join(runsDir, date, runId);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return date;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
  throw new Error(`Run not found: ${runId}`);
}

export async function replayRun(input: ReplayInput): Promise<ReplayResult> {
  const rootDir = input.rootDir ?? process.cwd();
  const date = input.date ?? (await findRunDate(rootDir, input.runId));
  const runDir = path.join(rootDir, "runs", date, input.runId);
  const snapshotPath = path.join(runDir, "config.snapshot.json");
  const legacyConfigPath = path.join(runDir, "config.json");
  const configPath = await fs
    .stat(snapshotPath)
    .then(() => snapshotPath)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return legacyConfigPath;
      throw error;
    });
  const [originalInput, originalOutput, rawConfig] = await Promise.all([
    fs.readFile(path.join(runDir, "input.txt"), "utf8"),
    fs.readFile(path.join(runDir, "final.md"), "utf8"),
    fs.readFile(configPath, "utf8")
  ]);
  const config = JSON.parse(rawConfig) as RaxConfig;
  const runtime = await createDefaultRuntime({ rootDir, config });
  const replayed = await runtime.run(originalInput);
  const outputExact = originalOutput === replayed.output;
  const originalTrace = await readTrace(runDir);
  const replayTrace = await readTrace(path.join(rootDir, "runs", replayed.createdAt.slice(0, 10), replayed.runId));
  const traceDiffs = compareReplayTrace(originalTrace, replayTrace);
  const traceExact = traceDiffs.length === 0;
  const exact = outputExact && traceExact;

  return {
    originalRunId: input.runId,
    replayRunId: replayed.runId,
    runId: input.runId,
    date,
    provider: config.model.provider,
    originalOutput,
    replayedOutput: replayed.output,
    exact,
    outputExact,
    traceExact,
    outputDiffSummary: outputExact ? "exact match" : "final output differs",
    traceDiffSummary: traceExact
      ? config.model.provider === "mock"
        ? "mock replay deterministic trace matched"
        : "real provider replay trace matched for deterministic fields"
      : `trace differs: ${traceDiffs.join(", ")}`,
    reason: exact
      ? undefined
      : [
          outputExact ? undefined : "Replay output did not match original final.md",
          traceExact ? undefined : "Replay trace differed on deterministic fields"
        ].filter(Boolean).join("; ")
  };
}

type ReplayTrace = {
  mode?: unknown;
  boundaryMode?: unknown;
  selectedAgent?: unknown;
  policiesApplied?: unknown;
  modelCalls?: Array<{ role?: unknown; provider?: unknown; model?: unknown }>;
  validation?: { valid?: unknown };
  schemaRetries?: unknown;
  repairPasses?: unknown;
};

async function readTrace(runDir: string): Promise<ReplayTrace> {
  try {
    return JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as ReplayTrace;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Replay trace missing: ${path.join(runDir, "trace.json")}`);
    }
    throw error;
  }
}

function compareReplayTrace(original: ReplayTrace, replayed: ReplayTrace): string[] {
  const diffs: string[] = [];
  compareField("mode", original.mode, replayed.mode, diffs);
  compareField("boundaryMode", original.boundaryMode, replayed.boundaryMode, diffs);
  compareField("selectedAgent", original.selectedAgent, replayed.selectedAgent, diffs);
  compareField("policiesApplied", original.policiesApplied, replayed.policiesApplied, diffs);
  compareField("modelCall roles", modelCallRoles(original), modelCallRoles(replayed), diffs);
  compareField("validation.valid", original.validation?.valid, replayed.validation?.valid, diffs);
  compareField("schemaRetries", original.schemaRetries, replayed.schemaRetries, diffs);
  compareField("repairPasses", original.repairPasses, replayed.repairPasses, diffs);
  return diffs;
}

function modelCallRoles(trace: ReplayTrace): Array<{ role?: unknown; provider?: unknown; model?: unknown }> {
  return trace.modelCalls?.map((call) => ({
    role: call.role,
    provider: call.provider,
    model: call.model
  })) ?? [];
}

function compareField(name: string, original: unknown, replayed: unknown, diffs: string[]): void {
  if (JSON.stringify(original) !== JSON.stringify(replayed)) {
    diffs.push(name);
  }
}
