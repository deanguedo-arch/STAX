import path from "node:path";
import { writeSoftGateTrialArtifacts } from "../src/sidecar/StaxSoftGateTrial.js";

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const { summary, runsPath, overridePath, reportPath } = await writeSoftGateTrialArtifacts(rootDir);
  console.log(
    [
      `Trial: ${summary.trialId}`,
      `Status: ${summary.status}`,
      `Total runs: ${summary.totalRuns}`,
      `Critical false accepts: ${summary.criticalFalseAccepts}`,
      `Build/test/typecheck false reject rate: ${summary.buildTestTypecheckFalseRejectRate}`,
      `Override rate: ${summary.overrideRate}`,
      `Next prompt actionable rate: ${summary.nextPromptActionableRate}`,
      `Runs: ${path.relative(rootDir, runsPath)}`,
      `Overrides: ${path.relative(rootDir, overridePath)}`,
      `Report: ${path.relative(rootDir, reportPath)}`
    ].join("\n")
  );
  if (summary.status === "failed") process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
