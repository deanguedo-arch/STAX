import {
  buildSidecarLearningDashboard,
  renderSidecarLearningDashboard
} from "../src/learning/SidecarLearningDashboard.js";

async function main(): Promise<void> {
  const dashboard = await buildSidecarLearningDashboard(process.cwd());
  process.stdout.write(renderSidecarLearningDashboard(dashboard));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
