import fs from "node:fs/promises";
import path from "node:path";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { loadConfig, mergeConfig } from "../src/core/ConfigLoader.js";
import { DEFAULT_CONFIG } from "../src/schemas/Config.js";
import { WorkspaceContext } from "../src/workspace/WorkspaceContext.js";

type CampaignTask = {
  id: string;
  workspace: string;
  category: string;
  prompt: string;
  expectsFakeCompleteCatch?: boolean;
};

type CampaignInput = {
  campaignId: string;
  createdAt: string;
  description: string;
  tasks: CampaignTask[];
};

type TaskResult = {
  id: string;
  workspace: string;
  category: string;
  prompt: string;
  runId: string;
  validationPassed: boolean;
  outputLength: number;
  oneNextAction: string | null;
  hasOneNextAction: boolean;
  codexPromptPresent: boolean;
  fakeCompleteCaught: boolean | null;
  cleanupPromptsNeeded: number;
  movedForward: boolean;
};

type CampaignResult = {
  campaignId: string;
  executedAt: string;
  provider: {
    generator: string;
    critic: string;
    evaluator: string;
  };
  taskCount: number;
  distinctReposUsed: number;
  usefulSessions: number;
  fakeCompleteChecks: number;
  fakeCompleteCaught: number;
  totalCleanupPromptsNeeded: number;
  movedForwardCount: number;
  uniqueOneNextActions: number;
  uniqueOutputShapes: number;
  warnings: string[];
  campaignStatus: "real_use_candidate" | "real_use_useful" | "real_use_not_proven";
  tasks: TaskResult[];
};

const FIXTURE_PATH = path.join(
  process.cwd(),
  "fixtures",
  "real_use",
  "phase10_real_workflow_10_tasks.json"
);

function extractSection(output: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  const match = output.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractOneNextAction(output: string): string | null {
  const section = extractSection(output, "One Next Action");
  if (!section) return null;
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const actionable = lines.filter((line) => /^(-|\d+\.)\s+/.test(line));
  if (actionable.length !== 1) return null;
  return actionable[0]?.replace(/^(-|\d+\.)\s+/, "").trim() ?? null;
}

function hasCodexPrompt(output: string): boolean {
  const section = extractSection(output, "Codex Prompt if needed");
  return section.length > 0;
}

function detectsFakeComplete(output: string): boolean {
  return /\bfake-complete\b|\bunverified\b|\bmissing proof\b|\bno command output\b/i.test(output);
}

function classifyCampaignStatus(result: CampaignResult): CampaignResult["campaignStatus"] {
  if (result.provider.generator === "mock") return "real_use_candidate";
  if (result.uniqueOutputShapes < Math.ceil(result.taskCount / 2)) return "real_use_candidate";
  if (result.uniqueOneNextActions < Math.ceil(result.taskCount / 2)) return "real_use_candidate";
  if (
    result.taskCount === 10 &&
    result.distinctReposUsed >= 3 &&
    result.usefulSessions >= 7
  ) {
    return "real_use_useful";
  }
  if (result.taskCount >= 10) return "real_use_candidate";
  return "real_use_not_proven";
}

function renderMarkdown(result: CampaignResult): string {
  const rows = result.tasks
    .map((task) => {
      const fakeComplete =
        task.fakeCompleteCaught === null ? "n/a" : task.fakeCompleteCaught ? "yes" : "no";
      return `| ${task.id} | ${task.workspace} | ${task.category} | ${task.validationPassed ? "yes" : "no"} | ${task.hasOneNextAction ? "yes" : "no"} | ${fakeComplete} | ${task.cleanupPromptsNeeded} | ${task.movedForward ? "yes" : "no"} |`;
    })
    .join("\n");

  return [
    "# Phase 10 Real Workflow Campaign",
    "",
    `Executed: ${result.executedAt}`,
    `Campaign: ${result.campaignId}`,
    "",
    "## Summary",
    `- Task count: ${result.taskCount}`,
    `- Distinct repos used: ${result.distinctReposUsed}`,
    `- Useful sessions: ${result.usefulSessions}/${result.taskCount}`,
    `- Fake-complete checks caught: ${result.fakeCompleteCaught}/${result.fakeCompleteChecks}`,
    `- Total cleanup prompts needed: ${result.totalCleanupPromptsNeeded}`,
    `- Moved project forward: ${result.movedForwardCount}/${result.taskCount}`,
    `- Unique next actions: ${result.uniqueOneNextActions}/${result.taskCount}`,
    `- Unique output shapes: ${result.uniqueOutputShapes}/${result.taskCount}`,
    `- Campaign status: ${result.campaignStatus}`,
    "",
    "## Warnings",
    ...(result.warnings.length > 0 ? result.warnings.map((warning) => `- ${warning}`) : ["- none"]),
    "",
    "## Task Results",
    "| Task | Workspace | Category | Validation | One Next Action | Fake-Complete Caught | Cleanup Prompts Needed | Moved Forward |",
    "|---|---|---|---|---|---|---|---|",
    rows,
    "",
    "## Notes",
    "- This campaign is run through STAX `project_control` mode using live registered workspaces.",
    "- It evaluates STAX answer quality and decision hygiene, not autonomous code execution.",
    "- Follow-up Codex execution outcomes should be recorded in the real-use report when available."
  ].join("\n");
}

async function main(): Promise<void> {
  const raw = await fs.readFile(FIXTURE_PATH, "utf8");
  const campaign = JSON.parse(raw) as CampaignInput;
  if (!Array.isArray(campaign.tasks) || campaign.tasks.length !== 10) {
    throw new Error("Phase 10 campaign fixture must contain exactly 10 tasks.");
  }

  const loadedConfig = await loadConfig(process.cwd());
  const mergedConfig = mergeConfig(DEFAULT_CONFIG, loadedConfig);
  const runtime = await createDefaultRuntime();
  const workspaceContext = new WorkspaceContext();

  const taskResults: TaskResult[] = [];
  const repos = new Set<string>();

  for (const task of campaign.tasks) {
    const workspace = await workspaceContext.resolve({ workspace: task.workspace, requireWorkspace: true });
    repos.add(workspace.workspace ?? task.workspace);

    const output = await runtime.run(task.prompt, [], {
      mode: "project_control",
      workspace: workspace.workspace,
      linkedRepoPath: workspace.linkedRepoPath
    });

    const oneNextAction = extractOneNextAction(output.output);
    const hasOneNextAction = oneNextAction !== null;
    const codexPromptPresent = hasCodexPrompt(output.output);
    const fakeCompleteCaught = task.expectsFakeCompleteCatch
      ? detectsFakeComplete(output.output)
      : null;
    const cleanupPromptsNeeded = output.validation.valid && hasOneNextAction ? 0 : 1;
    const movedForward = output.validation.valid && hasOneNextAction && (task.expectsFakeCompleteCatch ? fakeCompleteCaught === true : true);

    taskResults.push({
      id: task.id,
      workspace: task.workspace,
      category: task.category,
      prompt: task.prompt,
      runId: output.runId,
      validationPassed: output.validation.valid,
      outputLength: output.output.length,
      oneNextAction,
      hasOneNextAction,
      codexPromptPresent,
      fakeCompleteCaught,
      cleanupPromptsNeeded,
      movedForward
    });
  }

  const fakeCompleteChecks = taskResults.filter((task) => task.fakeCompleteCaught !== null).length;
  const fakeCompleteCaught = taskResults.filter((task) => task.fakeCompleteCaught === true).length;
  const usefulSessions = taskResults.filter((task) => task.validationPassed && task.movedForward).length;
  const totalCleanupPromptsNeeded = taskResults.reduce((sum, task) => sum + task.cleanupPromptsNeeded, 0);
  const movedForwardCount = taskResults.filter((task) => task.movedForward).length;
  const uniqueOneNextActions = new Set(taskResults.map((task) => task.oneNextAction ?? "")).size;
  const uniqueOutputShapes = new Set(taskResults.map((task) => task.outputLength)).size;
  const executedAt = new Date().toISOString();
  const warnings: string[] = [];
  if (mergedConfig.model.generatorProvider === "mock") {
    warnings.push("Generator provider is mock; campaign quality should be treated as candidate-only.");
  }
  if (uniqueOutputShapes < Math.ceil(taskResults.length / 2)) {
    warnings.push("Low output-shape diversity detected across tasks; review for generic-template behavior.");
  }
  if (uniqueOneNextActions < Math.ceil(taskResults.length / 2)) {
    warnings.push("Low next-action diversity detected across tasks; review for repetitive action fallback.");
  }

  const result: CampaignResult = {
    campaignId: campaign.campaignId,
    executedAt,
    provider: {
      generator: mergedConfig.model.generatorProvider,
      critic: mergedConfig.model.criticProvider,
      evaluator: mergedConfig.model.evaluatorProvider
    },
    taskCount: taskResults.length,
    distinctReposUsed: repos.size,
    usefulSessions,
    fakeCompleteChecks,
    fakeCompleteCaught,
    totalCleanupPromptsNeeded,
    movedForwardCount,
    uniqueOneNextActions,
    uniqueOutputShapes,
    warnings,
    campaignStatus: "real_use_candidate",
    tasks: taskResults
  };
  result.campaignStatus = classifyCampaignStatus(result);

  const runId = `phase10_campaign_${executedAt.replace(/[:.]/g, "-")}`;
  const baseDir = path.join(process.cwd(), "runs", "real_use_campaign", executedAt.slice(0, 10));
  await fs.mkdir(baseDir, { recursive: true });

  const jsonPath = path.join(baseDir, `${runId}.json`);
  const mdPath = path.join(baseDir, `${runId}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), "utf8");
  await fs.writeFile(mdPath, renderMarkdown(result), "utf8");

  const summary = {
    campaignId: result.campaignId,
    executedAt: result.executedAt,
    campaignStatus: result.campaignStatus,
    usefulSessions: `${result.usefulSessions}/${result.taskCount}`,
    fakeCompleteCaught: `${result.fakeCompleteCaught}/${result.fakeCompleteChecks}`,
    totalCleanupPromptsNeeded: result.totalCleanupPromptsNeeded,
    distinctReposUsed: result.distinctReposUsed,
    artifactJson: path.relative(process.cwd(), jsonPath),
    artifactMarkdown: path.relative(process.cwd(), mdPath)
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
