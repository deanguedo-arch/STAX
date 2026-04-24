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
  const exact = originalOutput === replayed.output;

  return {
    originalRunId: input.runId,
    replayRunId: replayed.runId,
    runId: input.runId,
    date,
    provider: config.model.provider,
    originalOutput,
    replayedOutput: replayed.output,
    exact,
    outputDiffSummary: exact ? "exact match" : "final output differs",
    traceDiffSummary:
      config.model.provider === "mock"
        ? exact
          ? "mock replay deterministic output matched"
          : "mock replay drift detected"
        : "real provider replay may drift",
    reason: exact ? undefined : "Replay output did not match original final.md"
  };
}
