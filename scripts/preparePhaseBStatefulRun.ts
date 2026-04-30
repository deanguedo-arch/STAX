import fs from "node:fs/promises";
import path from "node:path";

type PhaseBCases = {
  benchmarkId: string;
  scoringRubricVersion: string;
  criticalMissRulesVersion: string;
  cases: Array<{
    taskId: string;
    workspace: string;
    category: string;
    prompt: string;
  }>;
};

function parseArgs(): { runId: string } {
  const flag = process.argv.find((arg) => arg.startsWith("--run="));
  const runId = flag?.slice("--run=".length).trim();
  return { runId: runId || `phaseB-stateful-${new Date().toISOString().slice(0, 10)}` };
}

async function main(): Promise<void> {
  const { runId } = parseArgs();
  const root = process.cwd();
  const casesPath = path.join(
    root,
    "fixtures",
    "manual_benchmark",
    "stax_vs_raw_chatgpt_phaseB_stateful_20_cases.json"
  );
  const casesRaw = await fs.readFile(casesPath, "utf8");
  const phaseB = JSON.parse(casesRaw) as PhaseBCases;
  const runDir = path.join(root, "fixtures", "real_use", "runs", runId);
  await fs.mkdir(runDir, { recursive: true });

  const cases = {
    cases: phaseB.cases
  };
  const captures = {
    captures: phaseB.cases.map((item) => ({
      taskId: item.taskId,
      workspace: item.workspace,
      category: item.category,
      prompt: item.prompt,
      staxOutput: "",
      chatgptOutput: "",
      note: ""
    }))
  };
  const scores = {
    entries: phaseB.cases.map((item) => ({
      taskId: item.taskId,
      staxScore: null,
      chatgptScore: null,
      staxCriticalMiss: null,
      chatgptCriticalMiss: null,
      note: ""
    }))
  };
  const report = [
    `# ${runId}`,
    "",
    "## Summary",
    `- Total scored cases: ${phaseB.cases.length}`,
    "- STAX wins: 0",
    "- ChatGPT wins: 0",
    `- Ties: ${phaseB.cases.length}`,
    "- STAX critical misses: 0",
    "- ChatGPT critical misses: 0",
    "",
    "## Status",
    "- capture_required"
  ].join("\n");
  const manifest = {
    runId,
    createdAt: new Date().toISOString(),
    caseCount: phaseB.cases.length,
    staxSource: "local_stax_cli_stateful",
    chatgptSource: "raw_chatgpt_browser",
    scoringRubricVersion: phaseB.scoringRubricVersion,
    criticalMissRulesVersion: phaseB.criticalMissRulesVersion,
    canonicalScoresFile: "scores.json",
    canonicalReportFile: "report.md"
  };

  await fs.writeFile(path.join(runDir, "cases.json"), JSON.stringify(cases, null, 2));
  await fs.writeFile(path.join(runDir, "captures.json"), JSON.stringify(captures, null, 2));
  await fs.writeFile(path.join(runDir, "scores.json"), JSON.stringify(scores, null, 2));
  await fs.writeFile(path.join(runDir, "report.md"), `${report}\n`);
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "prepared",
        runId,
        runDir: path.relative(root, runDir),
        caseCount: phaseB.cases.length
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
