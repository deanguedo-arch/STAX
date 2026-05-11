import fs from "node:fs/promises";
import path from "node:path";
import {
  buildStaxTrialResultsArtifact,
  evaluateStaxTrialLeague,
  loadStaxTrialLeague,
  renderStaxTrialFailureReport
} from "../src/sidecar/StaxTrialLeague.js";

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const generatedAt = new Date().toISOString();
  const league = await loadStaxTrialLeague(rootDir);
  const result = evaluateStaxTrialLeague(league);
  const fixtureDir = path.join(rootDir, "fixtures", "stax_trials");
  const resultsPath = path.join(fixtureDir, "results.json");
  const failureReportPath = path.join(fixtureDir, "failure_report.md");

  await fs.writeFile(
    resultsPath,
    `${JSON.stringify(buildStaxTrialResultsArtifact(result, { generatedAt }), null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(failureReportPath, renderStaxTrialFailureReport(result, generatedAt), "utf8");

  console.log(
    [
      `Fixture set: ${result.fixtureSet}`,
      `Expanded cases: ${result.expandedCases}`,
      `Critical false accepts: ${result.criticalFalseAccepts}`,
      `False rejects: ${result.falseRejects}`,
      `False reject rate: ${result.falseRejectRate}`,
      `Next prompt actionable rate: ${result.nextPromptActionableRate}`,
      `Status: ${result.passed ? "Pass" : "Fail"}`,
      `Results: ${path.relative(rootDir, resultsPath)}`,
      `Failure report: ${path.relative(rootDir, failureReportPath)}`
    ].join("\n")
  );

  if (!result.passed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
