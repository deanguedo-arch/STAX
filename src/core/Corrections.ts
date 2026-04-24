import fs from "node:fs/promises";
import path from "node:path";
import { CorrectionItemSchema } from "../schemas/zodSchemas.js";
import { createRunId } from "../utils/ids.js";
import { findRunDate } from "./Replay.js";

export type CorrectionErrorType =
  | "assumption_error"
  | "missing_signal"
  | "bad_routing"
  | "over_refusal"
  | "under_refusal"
  | "format_drift"
  | "hallucination"
  | "weak_plan"
  | "wrong_tone"
  | "missing_uncertainty"
  | "schema_failure";

export type CorrectionInput = {
  rootDir?: string;
  date?: string;
  runId: string;
  correctedOutput: string;
  reason: string;
  errorType?: CorrectionErrorType;
  policyViolated?: string;
  tags?: string[];
};

export type CorrectionRecord = {
  correctionId: string;
  runId: string;
  date: string;
  originalOutput: string;
  correctedOutput: string;
  reason: string;
  errorType: CorrectionErrorType;
  policyViolated?: string;
  tags: string[];
  approved: boolean;
  promoteToEval: boolean;
  promoteToTraining: boolean;
  createdAt: string;
  path: string;
  evalPath?: string;
  trainingPath?: string;
  goldenPath?: string;
};

export type PromoteCorrectionInput = {
  rootDir?: string;
  correctionId: string;
  promoteToEval?: boolean;
  promoteToTraining?: boolean;
  promoteToGolden?: boolean;
};

function correctionId(): string {
  return createRunId().replace(/^run-/, "corr-");
}

async function findCorrection(rootDir: string, correctionIdValue: string): Promise<CorrectionRecord> {
  const candidates = [
    path.join(rootDir, "corrections", "pending", `${correctionIdValue}.json`),
    path.join(rootDir, "corrections", "approved", `${correctionIdValue}.json`),
    path.join(rootDir, "corrections", `${correctionIdValue}.json`)
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf8");
      return { ...(JSON.parse(raw) as CorrectionRecord), path: candidate };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Correction not found: ${correctionIdValue}`);
}

export async function createCorrection(input: CorrectionInput): Promise<CorrectionRecord> {
  const rootDir = input.rootDir ?? process.cwd();
  const date = input.date ?? (await findRunDate(rootDir, input.runId));
  const runDir = path.join(rootDir, "runs", date, input.runId);
  const originalOutput = await fs.readFile(path.join(runDir, "final.md"), "utf8");
  const createdAt = new Date().toISOString();
  const id = correctionId();
  const dir = path.join(rootDir, "corrections", "pending");
  await fs.mkdir(dir, { recursive: true });
  const outputPath = path.join(dir, `${id}.json`);

  const record: CorrectionRecord = {
    correctionId: id,
    runId: input.runId,
    date,
    originalOutput,
    correctedOutput: input.correctedOutput,
    reason: input.reason,
    errorType: input.errorType ?? "schema_failure",
    policyViolated: input.policyViolated,
    tags: input.tags ?? [],
    approved: false,
    promoteToEval: false,
    promoteToTraining: false,
    createdAt,
    path: outputPath
  };

  CorrectionItemSchema.parse(record);
  await fs.writeFile(outputPath, JSON.stringify(record, null, 2), "utf8");
  await fs.appendFile(
    path.join(rootDir, "corrections", "correction_log.jsonl"),
    `${JSON.stringify(record)}\n`,
    "utf8"
  );
  return record;
}

export async function promoteCorrection(
  input: PromoteCorrectionInput
): Promise<CorrectionRecord> {
  const rootDir = input.rootDir ?? process.cwd();
  const record = await findCorrection(rootDir, input.correctionId);
  const approvedDir = path.join(rootDir, "corrections", "approved");
  await fs.mkdir(approvedDir, { recursive: true });

  const updated: CorrectionRecord = {
    ...record,
    approved: true,
    promoteToEval: Boolean(input.promoteToEval),
    promoteToTraining: Boolean(input.promoteToTraining)
  };

  if (input.promoteToEval) {
    const evalDir = path.join(rootDir, "evals", "regression");
    await fs.mkdir(evalDir, { recursive: true });
    const evalPath = path.join(evalDir, `${record.correctionId}.json`);
    await fs.writeFile(
      evalPath,
      JSON.stringify(
        {
          id: record.correctionId,
          mode: "analysis",
          input: record.reason,
          expectedProperties: ["mentions_unknowns"],
          forbiddenPatterns: [],
          requiredSections: [],
          critical: false,
          tags: record.tags
        },
        null,
        2
      ),
      "utf8"
    );
    updated.evalPath = evalPath;
  }

  if (input.promoteToTraining) {
    const trainingDir = path.join(rootDir, "training", "sft");
    await fs.mkdir(trainingDir, { recursive: true });
    const trainingPath = path.join(trainingDir, `${record.correctionId}.jsonl`);
    await fs.writeFile(
      trainingPath,
      `${JSON.stringify({
        messages: [
          { role: "system", content: "compiled policy bundle" },
          { role: "user", content: record.reason },
          { role: "assistant", content: record.correctedOutput }
        ],
        metadata: {
          mode: "analysis",
          policiesApplied: record.policyViolated ? [`${record.policyViolated}@1.0.0`] : [],
          source: "correction",
          runId: record.runId,
          errorType: record.errorType
        }
      })}\n`,
      "utf8"
    );
    updated.trainingPath = trainingPath;
  }

  if (input.promoteToGolden) {
    const goldenDir = path.join(rootDir, "goldens");
    await fs.mkdir(goldenDir, { recursive: true });
    const goldenPath = path.join(goldenDir, `${record.correctionId}.md`);
    await fs.writeFile(goldenPath, record.correctedOutput, "utf8");
    updated.goldenPath = goldenPath;
  }

  const approvedPath = path.join(approvedDir, `${record.correctionId}.json`);
  updated.path = approvedPath;
  CorrectionItemSchema.parse(updated);
  await fs.writeFile(approvedPath, JSON.stringify(updated, null, 2), "utf8");
  await fs.rm(record.path, { force: true });
  return updated;
}
