import path from "node:path";
import { writeRolloutPhaseGateArtifacts } from "../src/sidecar/RolloutPhaseGate.js";

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const { report, statusPath, markdownPath } = await writeRolloutPhaseGateArtifacts(rootDir);

  console.log(
    [
      `Status: ${report.status}`,
      `Next action: ${report.nextAction}`,
      `Status artifact: ${path.relative(rootDir, statusPath)}`,
      `Report artifact: ${path.relative(rootDir, markdownPath)}`
    ].join("\n")
  );

  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
