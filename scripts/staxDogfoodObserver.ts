import fs from "node:fs/promises";
import path from "node:path";
import {
  evaluateDogfoodLeague,
  loadDogfoodLeague,
  renderDogfoodObserverReport,
  renderDogfoodRegressionAdditions
} from "../src/sidecar/StaxDogfoodLeague.js";

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const generatedAt = new Date().toISOString();
  const league = await loadDogfoodLeague(rootDir);
  const summary = evaluateDogfoodLeague(league);
  const releaseDir = path.join(rootDir, "docs", "releases", "STAX_DOGFOOD_LEAGUE");
  const reportPath = path.join(releaseDir, "observer_report.md");
  const regressionPath = path.join(releaseDir, "regression_additions.md");

  await fs.writeFile(reportPath, renderDogfoodObserverReport(league, generatedAt), "utf8");
  await fs.writeFile(regressionPath, renderDogfoodRegressionAdditions(league, generatedAt), "utf8");

  console.log(
    [
      `League: ${summary.leagueId}`,
      `Status: ${summary.status}`,
      `Eligible observer runs: ${summary.eligibleRuns}`,
      `Bootstrap observations: ${summary.bootstrapObservations}`,
      `Critical false accepts: ${summary.criticalFalseAccepts}`,
      `False reject rate: ${summary.falseRejectRate}`,
      `Protocol compliance rate: ${summary.protocolComplianceRate}`,
      `Next prompt actionable rate: ${summary.nextPromptActionableRate}`,
      `Promotion gate passed: ${summary.promotionGatePassed}`,
      `Observer report: ${path.relative(rootDir, reportPath)}`,
      `Regression additions: ${path.relative(rootDir, regressionPath)}`
    ].join("\n")
  );

  if (summary.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
