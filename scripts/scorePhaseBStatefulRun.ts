import fs from "node:fs/promises";
import path from "node:path";
import { LocalProblemBenchmark } from "../src/compare/LocalProblemBenchmark.js";
import {
  buildPhaseBBenchmarkCollection,
  loadPhaseBCaptures,
  scorePhaseBStatefulRun
} from "../src/campaign/PhaseBStatefulBenchmark.js";

function parseArgs(): { runId: string } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  return { runId };
}

async function main(): Promise<void> {
  const { runId } = parseArgs();
  const runDir = path.join(process.cwd(), "fixtures", "real_use", "runs", runId);
  const captures = await loadPhaseBCaptures(runDir);
  const collection = buildPhaseBBenchmarkCollection(captures);
  const summary = await scorePhaseBStatefulRun(runDir);
  const scorer = new LocalProblemBenchmark(process.cwd());

  const summaryPath = path.join(runDir, "executable_benchmark_summary.json");
  const reportPath = path.join(runDir, "executable_benchmark_report.md");
  const fixturePath = path.join(runDir, "executable_benchmark_fixture.json");

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  await fs.writeFile(reportPath, `${scorer.formatSummary(summary)}\n`, "utf8");
  await fs.writeFile(fixturePath, JSON.stringify(collection, null, 2), "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "scored",
        runId,
        total: summary.total,
        staxBetter: summary.staxBetter,
        externalBetter: summary.externalBetter,
        ties: summary.ties,
        noLocalBasis: summary.noLocalBasis,
        noExternalBaseline: summary.noExternalBaseline,
        stopConditionMet: summary.stopConditionMet,
        superiorityStatus: summary.superiorityStatus,
        executableBenchmarkFixture: path.relative(process.cwd(), fixturePath),
        executableBenchmarkSummary: path.relative(process.cwd(), summaryPath),
        executableBenchmarkReport: path.relative(process.cwd(), reportPath)
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
