import fs from "node:fs/promises";
import path from "node:path";

type InvestorCases = {
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
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  return { runId: runId || `investor-proof-10-${new Date().toISOString().slice(0, 10)}` };
}

async function main(): Promise<void> {
  const { runId } = parseArgs();
  const root = process.cwd();
  const casesPath = path.join(
    root,
    "fixtures",
    "manual_benchmark",
    "stax_vs_raw_chatgpt_investor_10_cases.json"
  );
  const casesRaw = await fs.readFile(casesPath, "utf8");
  const investor = JSON.parse(casesRaw) as InvestorCases;
  const runDir = path.join(root, "fixtures", "real_use", "runs", runId);
  await fs.mkdir(runDir, { recursive: true });

  const cases = { cases: investor.cases };
  const captures = {
    captures: investor.cases.map((item) => ({
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
    entries: investor.cases.map((item) => ({
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
    `- Total scored cases: ${investor.cases.length}`,
    "- STAX wins: 0",
    "- ChatGPT wins: 0",
    `- Ties: ${investor.cases.length}`,
    "- STAX critical misses: 0",
    "- ChatGPT critical misses: 0",
    "",
    "## Status",
    "- capture_required"
  ].join("\n");
  const manifest = {
    runId,
    createdAt: new Date().toISOString(),
    caseCount: investor.cases.length,
    staxSource: "local_stax_cli_stateful",
    chatgptSource: "raw_chatgpt_iab",
    scoringRubricVersion: investor.scoringRubricVersion,
    criticalMissRulesVersion: investor.criticalMissRulesVersion,
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
        caseCount: investor.cases.length
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
