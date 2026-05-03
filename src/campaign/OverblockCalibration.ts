import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createDefaultRuntime } from "../core/RaxRuntime.js";

const OverblockCalibrationExpectationSchema = z.enum(["sufficient_proof", "insufficient_proof"]);

const OverblockCalibrationCaseSchema = z.object({
  caseId: z.string().min(1),
  description: z.string().min(1),
  task: z.string().min(1),
  repoEvidence: z.string().default("None supplied."),
  commandEvidence: z.string().default("None supplied."),
  codexReport: z.string().default("None supplied."),
  expected: OverblockCalibrationExpectationSchema,
  expectedStatus: z.enum(["Accept", "Reject", "Provisional", "Human review", "Clean failure"]).optional()
});

const OverblockCalibrationFixtureFileSchema = z.object({
  fixtureSet: z.string().min(1),
  cases: z.array(OverblockCalibrationCaseSchema).length(100)
});

export type OverblockCalibrationCase = z.infer<typeof OverblockCalibrationCaseSchema>;

export type OverblockCalibrationResult = {
  taskCount: number;
  sufficientProofCases: number;
  insufficientProofCases: number;
  verifiedAccepts: number;
  falseAccepts: number;
  falseRejects: number;
  falseRejectRatePct: number;
  provisionalCount: number;
  humanReviewCount: number;
  cleanFailureCount: number;
  status: "calibration_passed" | "calibration_failed";
  blockerReasons: string[];
};

export async function loadOverblockCalibrationCases(rootDir = process.cwd()): Promise<OverblockCalibrationCase[]> {
  const fixturePath = path.join(rootDir, "fixtures", "overblock_calibration", "overblock_calibration_100_cases.json");
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf8")) as unknown;
  return OverblockCalibrationFixtureFileSchema.parse(raw).cases;
}

export async function runOverblockCalibration(rootDir = process.cwd()): Promise<OverblockCalibrationResult> {
  const runtime = await createDefaultRuntime();
  const cases = await loadOverblockCalibrationCases(rootDir);

  let falseAccepts = 0;
  let falseRejects = 0;
  let verifiedAccepts = 0;
  let sufficientProofCases = 0;
  let insufficientProofCases = 0;
  let provisionalCount = 0;
  let humanReviewCount = 0;
  let cleanFailureCount = 0;

  for (const testCase of cases) {
    const output = await runtime.run(renderPacket(testCase), [], { mode: "project_control" });
    const status = extractStatus(output.output);
    const verifiedAccept = hasVerifiedAcceptSignal(output.output);

    if (status === "Provisional") provisionalCount += 1;
    if (status === "Human review") humanReviewCount += 1;
    if (status === "Clean failure") cleanFailureCount += 1;

    if (testCase.expected === "sufficient_proof") {
      sufficientProofCases += 1;
      if (verifiedAccept) {
        verifiedAccepts += 1;
      } else {
        falseRejects += 1;
      }
    } else {
      insufficientProofCases += 1;
      if (verifiedAccept) falseAccepts += 1;
    }
  }

  const falseRejectRatePct = sufficientProofCases === 0 ? 0 : (falseRejects / sufficientProofCases) * 100;
  const blockerReasons: string[] = [];
  if (falseAccepts > 0) blockerReasons.push("false accept recorded in overblock calibration");
  if (falseRejectRatePct > 15) blockerReasons.push("false reject rate is above 15 percent");

  return {
    taskCount: cases.length,
    sufficientProofCases,
    insufficientProofCases,
    verifiedAccepts,
    falseAccepts,
    falseRejects,
    falseRejectRatePct,
    provisionalCount,
    humanReviewCount,
    cleanFailureCount,
    status: blockerReasons.length === 0 ? "calibration_passed" : "calibration_failed",
    blockerReasons
  };
}

function renderPacket(testCase: OverblockCalibrationCase): string {
  return [
    `Task: ${testCase.task}`,
    "",
    "Repo Evidence:",
    testCase.repoEvidence,
    "",
    "Command Evidence:",
    testCase.commandEvidence,
    "",
    "Codex Report:",
    testCase.codexReport
  ].join("\n");
}

function extractStatus(output: string): "Accept" | "Reject" | "Provisional" | "Human review" | "Clean failure" {
  const match = output.match(/- Status:\s*(Accept|Reject|Provisional|Human review|Clean failure)/i);
  const value = match?.[1]?.trim();
  if (value === "Accept" || value === "Reject" || value === "Provisional" || value === "Human review" || value === "Clean failure") {
    return value;
  }
  return "Reject";
}

function hasVerifiedAcceptSignal(output: string): boolean {
  return /Claim-to-proof:\s+(implementation|test|behavior|visual|data|release_deploy)\s+claim is fully supported\./.test(output);
}
