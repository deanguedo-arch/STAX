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
  runId: string;
  date: string;
  originalOutput: string;
  replayedOutput: string;
  exact: boolean;
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
  const [originalInput, originalOutput, rawConfig] = await Promise.all([
    fs.readFile(path.join(runDir, "input.txt"), "utf8"),
    fs.readFile(path.join(runDir, "final.md"), "utf8"),
    fs.readFile(path.join(runDir, "config.json"), "utf8")
  ]);
  const config = JSON.parse(rawConfig) as RaxConfig;
  const runtime = await createDefaultRuntime({ rootDir, config });
  const replayed = await runtime.run(originalInput);

  return {
    runId: input.runId,
    date,
    originalOutput,
    replayedOutput: replayed.output,
    exact: originalOutput === replayed.output
  };
}
