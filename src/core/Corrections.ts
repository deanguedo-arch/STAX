import fs from "node:fs/promises";
import path from "node:path";
import { findRunDate } from "./Replay.js";

export type CorrectionInput = {
  rootDir?: string;
  date?: string;
  runId: string;
  correctedOutput: string;
  reason: string;
};

export type CorrectionRecord = {
  runId: string;
  date: string;
  originalOutput: string;
  correctedOutput: string;
  reason: string;
  createdAt: string;
  path: string;
};

export async function createCorrection(input: CorrectionInput): Promise<CorrectionRecord> {
  const rootDir = input.rootDir ?? process.cwd();
  const date = input.date ?? (await findRunDate(rootDir, input.runId));
  const runDir = path.join(rootDir, "runs", date, input.runId);
  const originalOutput = await fs.readFile(path.join(runDir, "final.md"), "utf8");
  const createdAt = new Date().toISOString();
  const dir = path.join(rootDir, "corrections");
  await fs.mkdir(dir, { recursive: true });
  const outputPath = path.join(dir, `${input.runId}.json`);

  const record: CorrectionRecord = {
    runId: input.runId,
    date,
    originalOutput,
    correctedOutput: input.correctedOutput,
    reason: input.reason,
    createdAt,
    path: outputPath
  };

  await fs.writeFile(outputPath, JSON.stringify(record, null, 2), "utf8");
  return record;
}
