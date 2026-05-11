import fs from "node:fs/promises";
import path from "node:path";
import {
  STAX_AGENT_PROTOCOL,
  STAX_PROOF_REPORT_RELATIVE_PATH,
  STAX_SIDECAR_PROTOCOL_VERSION,
  upsertAgentsProtocolSection,
  upsertStaxGitignoreRules
} from "./AttachStax.js";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  pathExists,
  readTextIfExists,
  sidecarDir,
  validateRepoPath
} from "./SidecarRepo.js";
import { writeTurnContract } from "./TurnContract.js";

export { STAX_SIDECAR_PROTOCOL_VERSION } from "./AttachStax.js";

export type UpgradeStaxSidecarOptions = {
  repoPath: string;
};

export type UpgradeStaxSidecarResult = {
  repoPath: string;
  sidecarPath: string;
  targetProtocolVersion: string;
  changedFiles: string[];
  preservedFiles: string[];
  agentsPath: string;
  configPath: string;
  protocolPath: string;
};

type JsonObject = Record<string, unknown>;

export async function upgradeStaxSidecar(options: UpgradeStaxSidecarOptions): Promise<UpgradeStaxSidecarResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  const snapshot = await collectGitSnapshot(repoPath);
  const staxPath = sidecarDir(repoPath);
  const changedFiles: string[] = [];
  const preservedFiles: string[] = [];

  await ensureSidecarDirectories(staxPath);

  const configPath = path.join(staxPath, "config.json");
  const protocolPath = path.join(staxPath, "AGENT_PROTOCOL.md");
  const agentsPath = path.join(repoPath, "AGENTS.md");

  await writeTextIfChanged(configPath, `${JSON.stringify(await mergedConfig(configPath, snapshot), null, 2)}\n`, changedFiles);
  await writeTextIfChanged(protocolPath, `${STAX_AGENT_PROTOCOL}\n`, changedFiles);
  await writeTextIfChanged(agentsPath, `${upsertAgentsProtocolSection(await readTextIfExists(agentsPath)).trimEnd()}\n`, changedFiles);
  await ensureGeneratedArtifactIgnores(path.join(repoPath, ".gitignore"), changedFiles);

  await writePreservedIfMissing(path.join(staxPath, "task.md"), "", changedFiles, preservedFiles);
  await writePreservedIfMissing(path.join(staxPath, "codex-report.md"), "", changedFiles, preservedFiles);
  await writePreservedIfMissing(path.join(staxPath, "ledger.json"), `${JSON.stringify({ schemaVersion: "stax-sidecar-ledger-v1", tasks: [] }, null, 2)}\n`, changedFiles, preservedFiles);
  await writePreservedIfMissing(
    path.join(staxPath, "learning-ledger.json"),
    `${JSON.stringify({ schemaVersion: "stax-sidecar-learning-ledger-v1", events: [] }, null, 2)}\n`,
    changedFiles,
    preservedFiles
  );
  await writeTextIfMissing(path.join(staxPath, "status.md"), defaultStatusMarkdown(), changedFiles);
  await writeTextIfMissing(
    path.join(staxPath, "status.json"),
    `${JSON.stringify(
      {
        schemaVersion: "stax-sidecar-status-v1",
        generatedAt: nowIso(),
        verdict: "Provisional",
        why: "STAX Sidecar is attached; no audit has run yet."
      },
      null,
      2
    )}\n`,
    changedFiles
  );
  await writeTextIfMissing(
    path.join(staxPath, "next-codex-prompt.md"),
    "Write or update .stax/codex-report.md with the required STAX project-control report fields, then stop.\n",
    changedFiles
  );
  await writeTextIfMissing(
    path.join(repoPath, STAX_PROOF_REPORT_RELATIVE_PATH),
    defaultProofReportMarkdown(snapshot.repoName, snapshot.branch, snapshot.commitSha),
    changedFiles
  );
  await writeTurnContractIfMissing(repoPath, changedFiles);

  return {
    repoPath,
    sidecarPath: staxPath,
    targetProtocolVersion: STAX_SIDECAR_PROTOCOL_VERSION,
    changedFiles,
    preservedFiles,
    agentsPath,
    configPath,
    protocolPath
  };
}

async function ensureSidecarDirectories(staxPath: string): Promise<void> {
  await ensureDirectory(staxPath);
  await ensureDirectory(path.join(staxPath, "command-evidence"));
  await ensureDirectory(path.join(staxPath, "events"));
  await ensureDirectory(path.join(staxPath, "imports"));
  await ensureDirectory(path.join(staxPath, "reports"));
  await ensureDirectory(path.join(staxPath, "runtime"));
  await ensureDirectory(path.join(staxPath, "turns"));
}

async function mergedConfig(configPath: string, snapshot: Awaited<ReturnType<typeof collectGitSnapshot>>): Promise<JsonObject> {
  const existing = await readJsonObjectIfExists(configPath);
  return {
    schemaVersion: "stax-sidecar-config-v1",
    attachedAt: existing.attachedAt ?? nowIso(),
    requireCodexReportForDiff: true,
    requireFreshCodexTurnCapture: false,
    runtimeFreshnessMode: "normal",
    turnComplianceMode: "normal",
    maxCodexTurnAgeMs: 300000,
    maxSidecarHeartbeatAgeMs: 300000,
    dangerousCommandsRequireAllowRisky: true,
    ...existing,
    sidecarProtocolVersion: STAX_SIDECAR_PROTOCOL_VERSION,
    repoName: snapshot.repoName,
    repoPath: snapshot.repoPath,
    branch: snapshot.branch ?? null,
    commitSha: snapshot.commitSha ?? null
  };
}

async function readJsonObjectIfExists(filePath: string): Promise<JsonObject> {
  const raw = await readTextIfExists(filePath);
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Sidecar config must be a JSON object: ${filePath}`);
  }
  return parsed as JsonObject;
}

async function ensureGeneratedArtifactIgnores(gitignorePath: string, changedFiles: string[]): Promise<void> {
  const existing = await readTextIfExists(gitignorePath);
  await writeTextIfChanged(gitignorePath, upsertStaxGitignoreRules(existing), changedFiles);
}

async function writePreservedIfMissing(filePath: string, content: string, changedFiles: string[], preservedFiles: string[]): Promise<void> {
  if (await pathExists(filePath)) {
    preservedFiles.push(filePath);
    return;
  }
  await writeTextIfChanged(filePath, content, changedFiles);
}

async function writeTextIfMissing(filePath: string, content: string, changedFiles: string[]): Promise<void> {
  if (await pathExists(filePath)) return;
  await writeTextIfChanged(filePath, content, changedFiles);
}

async function writeTextIfChanged(filePath: string, content: string, changedFiles: string[]): Promise<void> {
  const existing = await readTextIfExists(filePath);
  if (existing === content) return;
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  changedFiles.push(filePath);
}

async function writeTurnContractIfMissing(repoPath: string, changedFiles: string[]): Promise<void> {
  const contractPath = path.join(sidecarDir(repoPath), "turn-contract.json");
  if (await pathExists(contractPath)) return;
  await writeTurnContract({ repoPath });
  changedFiles.push(contractPath);
}

function defaultStatusMarkdown(): string {
  return [
    "## Verdict",
    "- Status: Provisional",
    "- Why: STAX Sidecar is attached; no audit has run yet.",
    "",
    "## Verified",
    "- Sidecar files are present.",
    "",
    "## Weak / Provisional",
    "- No Codex report has been audited yet.",
    "",
    "## Unverified",
    "- Current task proof state.",
    "",
    "## Risk",
    "- None recorded yet.",
    "",
    "## One Next Action",
    "- Write the current task in .stax/task.md or run stax:gate when work starts.",
    "",
    "## Codex Prompt if needed",
    "Write or update .stax/codex-report.md with the required STAX project-control report fields, then stop.",
    ""
  ].join("\n");
}

function defaultProofReportMarkdown(repoName: string, branch?: string, commitSha?: string): string {
  const optionalRepoLines = [
    repoName ? `- Repo: ${repoName}` : "",
    branch ? `- Branch: ${branch}` : "",
    commitSha ? `- Commit: ${commitSha}` : ""
  ].filter(Boolean);
  return [
    "# STAX Proof Report",
    "",
    "Generated by `stax gate`. This file is the stable repo-tracked proof summary.",
    "",
    "## Verdict",
    "- Status: Provisional",
    "- Why: STAX Sidecar is attached; no audit has run yet.",
    ...optionalRepoLines,
    "",
    "## Proof Strength",
    "- No proof-strength artifact has been generated yet.",
    "",
    "## Evidence Artifacts",
    "- Status JSON: .stax/status.json",
    "- Proof strength JSON: .stax/proof_strength.json",
    "- Next Codex prompt: .stax/next-codex-prompt.md",
    "- Raw Codex working report: .stax/codex-report.md (local sidecar input)",
    "",
    "## One Next Action",
    "- Write the current task in .stax/task.md or run stax gate when work starts.",
    ""
  ].join("\n");
}
