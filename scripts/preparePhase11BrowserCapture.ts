import fs from "node:fs/promises";
import path from "node:path";

type Phase10Task = {
  id: string;
  workspace: string;
  category: string;
  prompt: string;
  runId: string;
};

type Phase10Artifact = {
  campaignId: string;
  executedAt: string;
  tasks: Phase10Task[];
};

type CaptureEntry = {
  taskId: string;
  workspace: string;
  category: string;
  prompt: string;
  staxRunId: string | null;
  staxOutputPath: string | null;
  staxOutput: string | null;
  chatgptOutput: string | null;
  staxScore: number | null;
  chatgptScore: number | null;
  staxCriticalMiss: boolean | null;
  chatgptCriticalMiss: boolean | null;
  note: string;
};

type CaptureFile = {
  campaignId: string;
  generatedAt: string;
  phase10Artifact: string;
  instructions: string;
  entries: CaptureEntry[];
};

const FIXTURE_PATH = path.join(
  process.cwd(),
  "fixtures",
  "real_use",
  "phase11_subscription_capture.json"
);

function parseArgs(): { artifactPath?: string } {
  const flag = process.argv.find((arg) => arg.startsWith("--artifact="));
  if (!flag) return {};
  const value = flag.slice("--artifact=".length).trim();
  if (!value) return {};
  return {
    artifactPath: path.isAbsolute(value) ? value : path.join(process.cwd(), value)
  };
}

async function findLatestPhase10Artifact(): Promise<string> {
  const root = path.join(process.cwd(), "runs", "real_use_campaign");
  const dateDirs = await fs.readdir(root).catch(() => []);
  const candidates: Array<{ full: string; mtime: number }> = [];

  for (const dateDir of dateDirs) {
    const fullDir = path.join(root, dateDir);
    const stat = await fs.stat(fullDir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const files = await fs.readdir(fullDir).catch(() => []);
    for (const file of files) {
      if (!file.startsWith("phase10_campaign_") || !file.endsWith(".json")) continue;
      const full = path.join(fullDir, file);
      const fileStat = await fs.stat(full).catch(() => null);
      if (!fileStat) continue;
      candidates.push({ full, mtime: fileStat.mtimeMs });
    }
  }

  if (candidates.length === 0) {
    throw new Error("No phase10 campaign artifacts found under runs/real_use_campaign.");
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]!.full;
}

async function loadPhase10Artifact(artifactPath: string): Promise<Phase10Artifact> {
  const raw = await fs.readFile(artifactPath, "utf8");
  const parsed = JSON.parse(raw) as Phase10Artifact;
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error("Phase10 artifact has no tasks.");
  }
  return parsed;
}

async function loadExistingCapture(): Promise<CaptureFile | null> {
  try {
    const raw = await fs.readFile(FIXTURE_PATH, "utf8");
    return JSON.parse(raw) as CaptureFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function runDirFromRunId(runId: string): string {
  const datePrefix = runId.slice("run-".length, "run-YYYY-MM-DD".length);
  return path.join(process.cwd(), "runs", datePrefix, runId);
}

async function loadStaxOutput(task: Phase10Task): Promise<{ staxOutputPath: string | null; staxOutput: string | null }> {
  if (!task.runId) return { staxOutputPath: null, staxOutput: null };
  const runDir = runDirFromRunId(task.runId);
  const finalPath = path.join(runDir, "final.md");
  try {
    const output = await fs.readFile(finalPath, "utf8");
    return {
      staxOutputPath: path.relative(process.cwd(), finalPath),
      staxOutput: output.trim()
    };
  } catch {
    return { staxOutputPath: null, staxOutput: null };
  }
}

function renderPromptPack(capture: CaptureFile): string {
  const sections = capture.entries
    .map((entry, index) => {
      return [
        `## Task ${index + 1}: ${entry.taskId}`,
        `- Workspace: ${entry.workspace}`,
        `- Category: ${entry.category}`,
        "",
        "Prompt to paste in ChatGPT:",
        "```text",
        "You are being tested on a project-control task.",
        "",
        "Rules:",
        "- Separate verified, weak/provisional, and unverified claims.",
        "- Do not claim tests passed unless local command evidence proves it.",
        "- Give one bounded next action.",
        "",
        "Return exactly these sections:",
        "## Verdict",
        "## Verified",
        "## Weak / Provisional",
        "## Unverified",
        "## Risk",
        "## One Next Action",
        "## Codex Prompt if needed",
        "",
        `Task: ${entry.prompt}`,
        "```",
        ""
      ].join("\n");
    })
    .join("\n");

  return [
    "# Phase 11 Browser-Assisted Prompt Pack",
    "",
    `Generated: ${capture.generatedAt}`,
    `Campaign: ${capture.campaignId}`,
    "",
    "Use this pack in ChatGPT subscription (browser) and paste each model answer into",
    "`fixtures/real_use/phase11_subscription_capture.json` under `chatgptOutput`.",
    "",
    sections
  ].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs();
  const artifactPath = args.artifactPath ?? (await findLatestPhase10Artifact());
  const phase10 = await loadPhase10Artifact(artifactPath);
  const existing = await loadExistingCapture();
  const existingByTaskId = new Map(
    (existing?.entries ?? []).map((entry) => [entry.taskId, entry] as const)
  );

  const entries: CaptureEntry[] = [];
  for (const task of phase10.tasks) {
    const { staxOutputPath, staxOutput } = await loadStaxOutput(task);
    const prior = existingByTaskId.get(task.id);
    entries.push({
      taskId: task.id,
      workspace: task.workspace,
      category: task.category,
      prompt: task.prompt,
      staxRunId: task.runId ?? null,
      staxOutputPath,
      staxOutput,
      chatgptOutput: prior?.chatgptOutput ?? null,
      staxScore: prior?.staxScore ?? null,
      chatgptScore: prior?.chatgptScore ?? null,
      staxCriticalMiss: prior?.staxCriticalMiss ?? null,
      chatgptCriticalMiss: prior?.chatgptCriticalMiss ?? null,
      note: prior?.note ?? ""
    });
  }

  const capture: CaptureFile = {
    campaignId: phase10.campaignId,
    generatedAt: new Date().toISOString(),
    phase10Artifact: path.relative(process.cwd(), artifactPath),
    instructions:
      "Paste each ChatGPT subscription answer into chatgptOutput, then score each row (0-10) and critical miss flags. Rerun campaign:phase11:subscription.",
    entries
  };

  await fs.mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await fs.writeFile(FIXTURE_PATH, JSON.stringify(capture, null, 2), "utf8");

  const runDate = capture.generatedAt.slice(0, 10);
  const runDir = path.join(process.cwd(), "runs", "real_use_campaign", runDate);
  await fs.mkdir(runDir, { recursive: true });
  const packPath = path.join(
    runDir,
    `phase11_browser_prompt_pack_${capture.generatedAt.replace(/[:.]/g, "-")}.md`
  );
  await fs.writeFile(packPath, renderPromptPack(capture), "utf8");

  const summary = {
    captureFile: path.relative(process.cwd(), FIXTURE_PATH),
    phase10Artifact: capture.phase10Artifact,
    promptPack: path.relative(process.cwd(), packPath),
    tasks: capture.entries.length
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
