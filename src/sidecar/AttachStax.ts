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

export const STAX_AGENT_PROTOCOL = `# STAX Project-Control Protocol

You are working under STAX project-control protocol.

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
    await writeFileIfMissing(filePath, content);
    if (!existed) createdFiles.push(filePath);
  }

  const agentsPath = path.join(repoPath, "AGENTS.md");
  const agentsBefore = await readTextIfExists(agentsPath);
  let appendedAgentsProtocol = false;
  if (!agentsBefore.includes(STAX_AGENTS_SECTION_MARKER)) {
    const section = [
      agentsBefore.trimEnd(),
      "",
      STAX_AGENTS_SECTION_MARKER,
      "",
      STAX_AGENT_PROTOCOL
    ]
      .filter(Boolean)
      .join("\n");
    await fs.writeFile(agentsPath, `${section.trimEnd()}\n`, "utf8");
    appendedAgentsProtocol = true;
  }

  return {
    repoPath,
    sidecarPath: staxPath,
    createdFiles,
    agentsPath,
    appendedAgentsProtocol
  };
}
