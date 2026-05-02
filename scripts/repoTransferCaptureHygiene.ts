import fs from "node:fs/promises";
import path from "node:path";
import {
  loadRepoTransferCaptures,
  validateRepoTransferRunCaptures
} from "../src/repoTransfer/RepoTransferRun.js";
import { isCaptureCorruptionIssue } from "../src/campaign/CaptureValidation.js";

function parseArgs(): { runId: string; write: boolean } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  return { runId, write: process.argv.includes("--write") };
}

function formatMarkdown(input: {
  runId: string;
  generatedAt: string;
  issueCount: number;
  contaminatedIssueCount: number;
  missingIssueCount: number;
  invalidCaseCount: number;
  issues: ReturnType<typeof validateRepoTransferRunCaptures>;
}): string {
  return [
    `# Repo Transfer Capture Hygiene: ${input.runId}`,
    "",
    "## Status",
    input.issueCount === 0 ? "- clean" : "- recapture_required",
    "",
    "## Summary",
    `- Generated at: ${input.generatedAt}`,
    `- Invalid capture outputs: ${input.issueCount}`,
    `- Contaminated capture outputs: ${input.contaminatedIssueCount}`,
    `- Missing capture outputs: ${input.missingIssueCount}`,
    `- Invalid case count: ${input.invalidCaseCount}`,
    "",
    "## Claim Boundary",
    input.issueCount === 0
      ? "- This run can proceed to scoring, subject to normal score/report integrity."
      : "- The current score claim is provisional. Do not claim a clean 60-0 result from this run until invalid ChatGPT captures are recaptured and rescored.",
    "",
    "## Issues",
    ...(input.issues.length
      ? input.issues.map((issue) => `- ${issue.taskId}/${issue.source}: ${issue.issues.join(", ")}`)
      : ["- none"])
  ].join("\n");
}

const { runId, write } = parseArgs();
const runDir = path.join(process.cwd(), "fixtures", "real_use", "runs", runId);
const captures = await loadRepoTransferCaptures(runDir);
const issues = validateRepoTransferRunCaptures(captures);
const generatedAt = new Date().toISOString();
const contaminatedIssues = issues.filter((issue) => issue.issues.some(isCaptureCorruptionIssue));
const contaminatedIssueCount = contaminatedIssues.length;
const contaminatedCaseCount = new Set(contaminatedIssues.map((issue) => issue.taskId)).size;
const missingIssueCount = issues.filter((issue) => issue.issues.includes("missing_output")).length;
const invalidCaseCount = new Set(issues.map((issue) => issue.taskId)).size;
const payload = {
  status: issues.length ? "recapture_required" : "clean",
  runId,
  generatedAt,
  invalidCaptureOutputs: issues.length,
  contaminatedCaptureOutputs: contaminatedIssueCount,
  missingCaptureOutputs: missingIssueCount,
  invalidCaseCount,
  contaminatedCaseCount,
  issues
};

if (write) {
  await fs.writeFile(path.join(runDir, "capture_hygiene_issues.json"), JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(
    path.join(runDir, "capture_hygiene_report.md"),
    `${formatMarkdown({
      runId,
      generatedAt,
      issueCount: issues.length,
      contaminatedIssueCount,
      missingIssueCount,
      invalidCaseCount,
      issues
    })}\n`,
    "utf8"
  );
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
