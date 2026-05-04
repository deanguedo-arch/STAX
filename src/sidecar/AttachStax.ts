import fs from "node:fs/promises";
import path from "node:path";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  pathExists,
  readTextIfExists,
  sidecarDir,
  validateRepoPath,
  writeFileIfMissing
} from "./SidecarRepo.js";

export const STAX_AGENTS_SECTION_MARKER = "<!-- STAX_PROJECT_CONTROL_PROTOCOL_V1 -->";
export const STAX_AGENTS_SECTION_END_MARKER = "<!-- /STAX_PROJECT_CONTROL_PROTOCOL_V1 -->";

export const STAX_AGENT_PROTOCOL = `# STAX Project-Control Protocol

You are working under STAX project-control protocol.

At the start of every Codex turn in this repo:

1. Read \`.stax/status.json\` if it exists.
2. If the verdict is \`Reject\`, \`Provisional\`, or \`Human review\`, read \`.stax/next-codex-prompt.md\` and treat it as the immediate correction task unless the user explicitly says to ignore STAX for this turn.
3. If \`.stax/task.md\` is blank, write the user's current objective there before editing.

Do not claim completion without proof.
Do not claim tests passed without command output.
Do not broaden scope.
Do not touch deploy, publish, sync, or release paths unless explicitly requested.
Do not treat docs-only changes as implementation proof.
Do not treat script existence as command execution proof.
Do not treat Codex-reported command output as strong local proof.

Before final response, write or update:

\`\`\`txt
.stax/codex-report.md
\`\`\`

Required report:

- Objective
- Files changed
- Tests added
- Commands run
- Command output summary with exit codes
- What is verified
- What is weak/provisional
- What is unverified
- Risks
- One next action
`;

export type AttachStaxResult = {
  repoPath: string;
  sidecarPath: string;
  createdFiles: string[];
  agentsPath: string;
  appendedAgentsProtocol: boolean;
};

export async function attachStaxToRepo(repoPathInput: string): Promise<AttachStaxResult> {
  const repoPath = await validateRepoPath(repoPathInput);
  const snapshot = await collectGitSnapshot(repoPath);
  const staxPath = sidecarDir(repoPath);
  const createdFiles: string[] = [];

  await ensureDirectory(staxPath);
  await ensureDirectory(path.join(staxPath, "command-evidence"));
  await ensureDirectory(path.join(staxPath, "events"));
  await ensureDirectory(path.join(staxPath, "imports"));
  await ensureDirectory(path.join(staxPath, "runtime"));
  await ensureDirectory(path.join(staxPath, "turns"));

  const files: Array<[string, string]> = [
    [
      path.join(staxPath, "config.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-config-v1",
          attachedAt: nowIso(),
          repoName: snapshot.repoName,
          repoPath,
          branch: snapshot.branch ?? null,
          commitSha: snapshot.commitSha ?? null,
          requireCodexReportForDiff: true,
          requireFreshCodexTurnCapture: true,
          maxCodexTurnAgeMs: 300000,
          maxSidecarHeartbeatAgeMs: 300000,
          dangerousCommandsRequireAllowRisky: true
        },
        null,
        2
      )}\n`
    ],
    [path.join(staxPath, "AGENT_PROTOCOL.md"), `${STAX_AGENT_PROTOCOL}\n`],
    [path.join(staxPath, "task.md"), ""],
    [path.join(staxPath, "codex-report.md"), ""],
    [
      path.join(staxPath, "status.md"),
      [
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
        "Write or update .stax/codex-report.md with the required STAX project-control report fields, then stop."
      ].join("\n") + "\n"
    ],
    [
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
      )}\n`
    ],
    [
      path.join(staxPath, "next-codex-prompt.md"),
      "Write or update .stax/codex-report.md with the required STAX project-control report fields, then stop.\n"
    ],
    [
      path.join(staxPath, "ledger.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-ledger-v1",
          tasks: []
        },
        null,
        2
      )}\n`
    ],
    [
      path.join(staxPath, "learning-ledger.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-learning-ledger-v1",
          events: []
        },
        null,
        2
      )}\n`
    ]
  ];

  for (const [filePath, content] of files) {
    const existed = await pathExists(filePath);
    if (filePath.endsWith(path.join(".stax", "AGENT_PROTOCOL.md"))) {
      await fs.writeFile(filePath, content, "utf8");
    } else {
      await writeFileIfMissing(filePath, content);
    }
    if (!existed) createdFiles.push(filePath);
  }

  const agentsPath = path.join(repoPath, "AGENTS.md");
  const agentsBefore = await readTextIfExists(agentsPath);
  const appendedAgentsProtocol = !agentsBefore.includes(STAX_AGENTS_SECTION_MARKER);
  await fs.writeFile(agentsPath, `${upsertAgentsProtocolSection(agentsBefore).trimEnd()}\n`, "utf8");
  await upsertGeneratedArtifactIgnores(path.join(repoPath, ".gitignore"));

  return {
    repoPath,
    sidecarPath: staxPath,
    createdFiles,
    agentsPath,
    appendedAgentsProtocol
  };
}

async function upsertGeneratedArtifactIgnores(gitignorePath: string): Promise<void> {
  const existing = await readTextIfExists(gitignorePath);
  const required = [".stax/current-turn.json", ".stax/runtime/", ".stax/turns/"];
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const missing = required.filter((line) => !existingLines.has(line));
  if (missing.length === 0) return;

  const next = [existing.trimEnd(), "", "# STAX generated local capture artifacts", ...missing]
    .filter((line, index) => line || index > 0)
    .join("\n");
  await fs.writeFile(gitignorePath, `${next.trimStart()}\n`, "utf8");
}

export function renderAgentsProtocolSection(): string {
  return [STAX_AGENTS_SECTION_MARKER, STAX_AGENT_PROTOCOL.trimEnd(), STAX_AGENTS_SECTION_END_MARKER].join("\n");
}

export function upsertAgentsProtocolSection(existing: string): string {
  const section = renderAgentsProtocolSection();
  const markerIndex = existing.indexOf(STAX_AGENTS_SECTION_MARKER);
  if (markerIndex === -1) {
    return [existing.trimEnd(), section].filter(Boolean).join("\n\n");
  }

  const endIndex = existing.indexOf(STAX_AGENTS_SECTION_END_MARKER, markerIndex);
  if (endIndex >= 0) {
    const afterEnd = endIndex + STAX_AGENTS_SECTION_END_MARKER.length;
    return `${existing.slice(0, markerIndex).trimEnd()}\n\n${section}${existing.slice(afterEnd)}`;
  }

  return `${existing.slice(0, markerIndex).trimEnd()}\n\n${section}`;
}
