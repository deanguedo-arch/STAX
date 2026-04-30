import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  compareSubscriptionCampaign,
  type SubscriptionScoreEntry
} from "../src/campaign/SubscriptionCampaignComparison.js";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

type Phase10Summary = {
  campaignId: string;
  executedAt: string;
  campaignStatus: "real_use_candidate" | "real_use_useful" | "real_use_not_proven";
  usefulSessions: string;
  fakeCompleteCaught: string;
  totalCleanupPromptsNeeded: number;
  distinctReposUsed: number;
  artifactJson: string;
  artifactMarkdown: string;
};

type Phase10Fixture = {
  campaignId: string;
  tasks: Array<{ id: string; workspace: string; category: string; prompt: string }>;
};

type SubscriptionScoreInput = {
  campaignId: string;
  scoredAt?: string;
  scorer?: string;
  entries: Array<{
    taskId: string;
    staxScore: number | null;
    chatgptScore: number | null;
    staxCriticalMiss: boolean | null;
    chatgptCriticalMiss: boolean | null;
    note?: string;
  }>;
};

type SubscriptionCaptureInput = {
  campaignId: string;
  generatedAt?: string;
  phase10Artifact?: string;
  instructions?: string;
  entries: Array<{
    taskId: string;
    staxScore: number | null;
    chatgptScore: number | null;
    staxCriticalMiss: boolean | null;
    chatgptCriticalMiss: boolean | null;
    note?: string;
  }>;
};

type Phase11SubscriptionResult = {
  runId: string;
  executedAt: string;
  scoreFile: string;
  scorerVersion: string;
  rubricVersion: string;
  sourceModel: string;
  mockRun: Phase10Summary;
  comparison: ReturnType<typeof compareSubscriptionCampaign>;
};

const PHASE10_FIXTURE_PATH = path.join(
  process.cwd(),
  "fixtures",
  "real_use",
  "phase10_real_workflow_10_tasks.json"
);

function parseArgs(): { scoreFile: string } {
  const canonical = path.join(process.cwd(), "fixtures", "real_use", "phase11_subscription_capture.json");
  const scoreFileFlag = process.argv.find((arg) => arg.startsWith("--scores="));
  if (!scoreFileFlag) {
    return { scoreFile: canonical };
  }
  throw new Error(
    "Non-canonical score files are blocked. Use fixtures/real_use/phase11_subscription_capture.json."
  );
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Could not parse campaign summary JSON from output.");
  }
  return text.slice(start, end + 1);
}

async function runPhase10WithMock(): Promise<Phase10Summary> {
  const env = {
    ...process.env,
    RAX_GENERATOR_PROVIDER: "mock"
  };
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn("npm", ["run", "--silent", "campaign:phase10"], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "campaign:phase10 failed.");
  }

  const json = extractJsonObject(result.stdout);
  return JSON.parse(json) as Phase10Summary;
}

async function loadPhase10Fixture(): Promise<Phase10Fixture> {
  const raw = await fs.readFile(PHASE10_FIXTURE_PATH, "utf8");
  return JSON.parse(raw) as Phase10Fixture;
}

function isCompletedEntry(entry: SubscriptionScoreInput["entries"][number]): entry is SubscriptionScoreEntry {
  return (
    typeof entry.staxScore === "number" &&
    typeof entry.chatgptScore === "number" &&
    typeof entry.staxCriticalMiss === "boolean" &&
    typeof entry.chatgptCriticalMiss === "boolean"
  );
}

function toScoreInput(input: SubscriptionScoreInput | SubscriptionCaptureInput): SubscriptionScoreInput {
  return {
    campaignId: input.campaignId,
    entries: input.entries.map((entry) => ({
      taskId: entry.taskId,
      staxScore: entry.staxScore,
      chatgptScore: entry.chatgptScore,
      staxCriticalMiss: entry.staxCriticalMiss,
      chatgptCriticalMiss: entry.chatgptCriticalMiss,
      note: entry.note
    }))
  };
}

async function ensureScoreTemplate(
  scoreFile: string,
  fixture: Phase10Fixture
): Promise<{
  created: boolean;
  data: SubscriptionScoreInput;
  rawCaptureEntries: Array<{ taskId: string; chatgptOutput?: string | null }>;
}> {
  try {
    const raw = await fs.readFile(scoreFile, "utf8");
    const parsed = JSON.parse(raw) as SubscriptionScoreInput | SubscriptionCaptureInput;
    return {
      created: false,
      data: toScoreInput(parsed),
      rawCaptureEntries: (parsed.entries ?? []).map((entry) => ({
        taskId: entry.taskId,
        chatgptOutput: (entry as { chatgptOutput?: string | null }).chatgptOutput ?? null
      }))
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(scoreFile), { recursive: true });
  const template: SubscriptionCaptureInput = {
    campaignId: fixture.campaignId,
    instructions:
      "Paste each ChatGPT subscription answer into chatgptOutput (if present) and fill staxScore/chatgptScore + critical miss flags, then rerun campaign:phase11:subscription.",
    entries: fixture.tasks.map((task) => ({
      taskId: task.id,
      staxScore: null,
      chatgptScore: null,
      staxCriticalMiss: null,
      chatgptCriticalMiss: null,
      note: ""
    }))
  };
  await fs.writeFile(scoreFile, JSON.stringify(template, null, 2), "utf8");
  return {
    created: true,
    data: toScoreInput(template),
    rawCaptureEntries: template.entries.map((entry) => ({
      taskId: entry.taskId,
      chatgptOutput: (entry as { chatgptOutput?: string | null }).chatgptOutput ?? null
    }))
  };
}

function renderMarkdown(result: Phase11SubscriptionResult, templateCreated: boolean): string {
  const rows = result.comparison.cases
    .map(
      (item) =>
        `| ${item.taskId} | ${item.staxScore} | ${item.chatgptScore} | ${item.winner} | ${item.staxCriticalMiss ? "yes" : "no"} | ${item.chatgptCriticalMiss ? "yes" : "no"} |`
    )
    .join("\n");

  return [
    "# RAX Phase 11 Subscription Comparison Report",
    "",
    `Executed: ${result.executedAt}`,
    "",
    "## Mock Baseline Run",
    `- Campaign status: ${result.mockRun.campaignStatus}`,
    `- Useful sessions: ${result.mockRun.usefulSessions}`,
    `- Fake-complete catches: ${result.mockRun.fakeCompleteCaught}`,
    `- Cleanup prompts: ${result.mockRun.totalCleanupPromptsNeeded}`,
    `- Artifact: ${result.mockRun.artifactJson}`,
    "",
    "## Subscription Baseline Comparison",
    `- Score file: ${path.relative(process.cwd(), result.scoreFile)}`,
    `- Template created this run: ${templateCreated ? "yes" : "no"}`,
    `- Status: ${result.comparison.status}`,
    "",
    "## Summary",
    `- Total scored cases: ${result.comparison.summary.total}`,
    `- STAX wins: ${result.comparison.summary.staxWins}`,
    `- ChatGPT wins: ${result.comparison.summary.chatgptWins}`,
    `- Ties: ${result.comparison.summary.ties}`,
    `- STAX critical misses: ${result.comparison.summary.staxCriticalMisses}`,
    `- ChatGPT critical misses: ${result.comparison.summary.chatgptCriticalMisses}`,
    "",
    "## Notes",
    ...(result.comparison.notes.length > 0 ? result.comparison.notes.map((note) => `- ${note}`) : ["- none"]),
    "",
    "## Cases",
    "| Task | STAX | ChatGPT | Winner | STAX Critical Miss | ChatGPT Critical Miss |",
    "|---|---:|---:|---|---|---|",
    ...(rows ? [rows] : ["| none | - | - | - | - | - |"]),
    "",
    "## Promotion Boundary",
    "- Keep real-use quality in candidate status until all 10 cases are scored from the subscription baseline.",
    "- Promote only repeated STAX wins with zero STAX critical misses into stronger regression/redteam cases."
  ].join("\n");
}

async function main(): Promise<void> {
  const { scoreFile } = parseArgs();
  const executedAt = new Date().toISOString();
  const runId = `phase11_subscription_comparison_${executedAt.replace(/[:.]/g, "-")}`;
  const fixture = await loadPhase10Fixture();
  const mockRun = await runPhase10WithMock();

  const { created, data, rawCaptureEntries } = await ensureScoreTemplate(scoreFile, fixture);
  const integrity = validatePhase11CaptureIntegrity({
    campaignId: data.campaignId,
    entries: rawCaptureEntries
  });
  if (!integrity.pass) {
    const preview = integrity.issues
      .slice(0, 5)
      .map((issue) => `${issue.taskId}: ${issue.reason}`)
      .join("; ");
    throw new Error(`Capture integrity failed: ${preview}`);
  }
  const completedEntries = (data.entries ?? []).filter(isCompletedEntry);
  const comparison = compareSubscriptionCampaign(
    completedEntries,
    fixture.tasks.map((task) => task.id)
  );

  if (created) {
    comparison.notes.unshift(
      `Created score template at ${path.relative(process.cwd(), scoreFile)}. Fill the 10 task rows and rerun.`
    );
  }

  const result: Phase11SubscriptionResult = {
    runId,
    executedAt,
    scoreFile,
    scorerVersion: "phase11_subscription_v2",
    rubricVersion: "project_control_rubric_v1",
    sourceModel: "chatgpt_subscription_browser_assisted",
    mockRun,
    comparison
  };

  const baseDir = path.join(process.cwd(), "runs", "real_use_campaign", executedAt.slice(0, 10));
  await fs.mkdir(baseDir, { recursive: true });
  const jsonPath = path.join(baseDir, `${runId}.json`);
  const mdPath = path.join(baseDir, `${runId}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), "utf8");
  await fs.writeFile(mdPath, renderMarkdown(result, created), "utf8");

  const summary = {
    executedAt,
    status: comparison.status,
    scoreFile: path.relative(process.cwd(), scoreFile),
    templateCreated: created,
    mockArtifact: mockRun.artifactJson,
    phase11ArtifactJson: path.relative(process.cwd(), jsonPath),
    phase11ArtifactMarkdown: path.relative(process.cwd(), mdPath)
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
