import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  compareProviderCampaigns,
  type CampaignSnapshot
} from "../src/campaign/ProviderCampaignComparison.js";

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

type Phase11Result = {
  executedAt: string;
  providerRequested: "openai" | "ollama";
  mockRun: {
    summary: Phase10Summary;
    snapshot: CampaignSnapshot;
  };
  providerRun:
    | {
        summary: Phase10Summary;
        snapshot: CampaignSnapshot;
      }
    | {
        blocked: true;
        error: string;
      };
  comparison: ReturnType<typeof compareProviderCampaigns>;
};

function parseArgs(): { provider: "openai" | "ollama" } {
  const providerFlag = process.argv.find((arg) => arg.startsWith("--provider="));
  if (!providerFlag) return { provider: "openai" };
  const value = providerFlag.slice("--provider=".length).trim();
  if (value !== "openai" && value !== "ollama") {
    throw new Error("Phase 11 provider must be openai or ollama.");
  }
  return { provider: value };
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Could not parse campaign summary JSON from output.");
  }
  return text.slice(start, end + 1);
}

async function runPhase10WithProvider(
  provider: "mock" | "openai" | "ollama"
): Promise<Phase10Summary> {
  const env = {
    ...process.env,
    RAX_GENERATOR_PROVIDER: provider
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
    throw new Error(result.stderr.trim() || result.stdout.trim() || `campaign:phase10 failed for provider ${provider}`);
  }

  const json = extractJsonObject(result.stdout);
  return JSON.parse(json) as Phase10Summary;
}

async function loadCampaignSnapshot(summary: Phase10Summary): Promise<CampaignSnapshot> {
  const artifactPath = path.join(process.cwd(), summary.artifactJson);
  const raw = await fs.readFile(artifactPath, "utf8");
  const parsed = JSON.parse(raw) as CampaignSnapshot;
  return {
    campaignStatus: parsed.campaignStatus,
    provider: parsed.provider,
    taskCount: parsed.taskCount,
    usefulSessions: parsed.usefulSessions,
    totalCleanupPromptsNeeded: parsed.totalCleanupPromptsNeeded,
    fakeCompleteChecks: parsed.fakeCompleteChecks,
    fakeCompleteCaught: parsed.fakeCompleteCaught,
    uniqueOneNextActions: parsed.uniqueOneNextActions,
    uniqueOutputShapes: parsed.uniqueOutputShapes
  };
}

function renderMarkdown(result: Phase11Result): string {
  const providerRunSection =
    "blocked" in result.providerRun
      ? [
          "## Provider Run",
          `- Requested provider: ${result.providerRequested}`,
          "- Status: blocked",
          `- Error: ${result.providerRun.error}`
        ]
      : [
          "## Provider Run",
          `- Requested provider: ${result.providerRequested}`,
          `- Effective generator: ${result.providerRun.snapshot.provider.generator}`,
          `- Campaign status: ${result.providerRun.snapshot.campaignStatus}`,
          `- Useful sessions: ${result.providerRun.snapshot.usefulSessions}/${result.providerRun.snapshot.taskCount}`,
          `- Fake-complete catches: ${result.providerRun.snapshot.fakeCompleteCaught}/${result.providerRun.snapshot.fakeCompleteChecks}`,
          `- Cleanup prompts: ${result.providerRun.snapshot.totalCleanupPromptsNeeded}`,
          `- Unique next actions: ${result.providerRun.snapshot.uniqueOneNextActions}/${result.providerRun.snapshot.taskCount}`,
          `- Unique output shapes: ${result.providerRun.snapshot.uniqueOutputShapes}/${result.providerRun.snapshot.taskCount}`,
          `- Artifact: ${result.providerRun.summary.artifactJson}`
        ];

  return [
    "# RAX Phase 11 Provider Comparison Report",
    "",
    `Executed: ${result.executedAt}`,
    "",
    "## Mock Baseline",
    `- Effective generator: ${result.mockRun.snapshot.provider.generator}`,
    `- Campaign status: ${result.mockRun.snapshot.campaignStatus}`,
    `- Useful sessions: ${result.mockRun.snapshot.usefulSessions}/${result.mockRun.snapshot.taskCount}`,
    `- Fake-complete catches: ${result.mockRun.snapshot.fakeCompleteCaught}/${result.mockRun.snapshot.fakeCompleteChecks}`,
    `- Cleanup prompts: ${result.mockRun.snapshot.totalCleanupPromptsNeeded}`,
    `- Unique next actions: ${result.mockRun.snapshot.uniqueOneNextActions}/${result.mockRun.snapshot.taskCount}`,
    `- Unique output shapes: ${result.mockRun.snapshot.uniqueOutputShapes}/${result.mockRun.snapshot.taskCount}`,
    `- Artifact: ${result.mockRun.summary.artifactJson}`,
    "",
    ...providerRunSection,
    "",
    "## Comparison",
    `- Status: ${result.comparison.status}`,
    `- Useful sessions delta: ${result.comparison.deltas.usefulSessionsDelta}`,
    `- Cleanup delta (provider - mock): ${result.comparison.deltas.cleanupDelta}`,
    `- Fake-complete delta: ${result.comparison.deltas.fakeCompleteDelta}`,
    `- Unique actions delta: ${result.comparison.deltas.uniqueActionsDelta}`,
    `- Unique shapes delta: ${result.comparison.deltas.uniqueShapesDelta}`,
    "",
    "## Notes",
    ...(result.comparison.notes.length > 0 ? result.comparison.notes.map((note) => `- ${note}`) : ["- none"]),
    "",
    "## Promotion Boundary",
    "- Keep real-use status as candidate-only until a non-mock provider run executes cleanly and shows no safety regressions.",
    "- Promote only repeated provider-backed wins into stronger regression/redteam cases."
  ].join("\n");
}

async function main(): Promise<void> {
  const { provider } = parseArgs();
  const executedAt = new Date().toISOString();

  const mockSummary = await runPhase10WithProvider("mock");
  const mockSnapshot = await loadCampaignSnapshot(mockSummary);

  let providerRun: Phase11Result["providerRun"];
  try {
    const summary = await runPhase10WithProvider(provider);
    const snapshot = await loadCampaignSnapshot(summary);
    providerRun = { summary, snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    providerRun = { blocked: true, error: message };
  }

  const comparison = compareProviderCampaigns(
    mockSnapshot,
    "blocked" in providerRun ? null : providerRun.snapshot
  );

  const result: Phase11Result = {
    executedAt,
    providerRequested: provider,
    mockRun: {
      summary: mockSummary,
      snapshot: mockSnapshot
    },
    providerRun,
    comparison
  };

  const runId = `phase11_provider_comparison_${executedAt.replace(/[:.]/g, "-")}`;
  const baseDir = path.join(process.cwd(), "runs", "real_use_campaign", executedAt.slice(0, 10));
  await fs.mkdir(baseDir, { recursive: true });
  const jsonPath = path.join(baseDir, `${runId}.json`);
  const mdPath = path.join(baseDir, `${runId}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), "utf8");
  await fs.writeFile(mdPath, renderMarkdown(result), "utf8");

  const summary = {
    executedAt,
    providerRequested: provider,
    comparisonStatus: comparison.status,
    mockArtifact: mockSummary.artifactJson,
    providerArtifact: "blocked" in providerRun ? null : providerRun.summary.artifactJson,
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
