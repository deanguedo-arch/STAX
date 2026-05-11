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
import {
  displayExternalEvidencePath,
  externalCommandEvidenceRepoId,
  externalEvidenceRoot
} from "./ExternalCommandEvidenceStore.js";
import { writeTurnContract } from "./TurnContract.js";

export const STAX_AGENTS_SECTION_MARKER = "<!-- STAX_PROJECT_CONTROL_PROTOCOL_V1 -->";
export const STAX_AGENTS_SECTION_END_MARKER = "<!-- /STAX_PROJECT_CONTROL_PROTOCOL_V1 -->";
export const STAX_SIDECAR_PROTOCOL_VERSION = "stax-project-control-protocol-v1";
export const STAX_PROOF_REPORT_RELATIVE_PATH = ".stax/reports/latest-proof-report.md";
export const STAX_CONFIDENCE_REPORT_RELATIVE_PATH = ".stax/reports/latest-confidence-report.md";

const STAX_GITIGNORE_BLOCK_HEADER = "# STAX generated local sidecar artifacts";
const STAX_GITIGNORE_BLOCK_LINES = [
  STAX_GITIGNORE_BLOCK_HEADER,
  ".stax/*",
  "!.stax/",
  "!.stax/status.json",
  "!.stax/next-codex-prompt.md",
  "!.stax/proof_strength.json",
  "!.stax/reports/",
  `!${STAX_PROOF_REPORT_RELATIVE_PATH}`,
  `!${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`
];

export const STAX_AGENT_PROTOCOL = `# STAX Project-Control Protocol

You are working under STAX project-control protocol.

At the start of every Codex turn in this repo:

1. Read \`.stax/turn-contract.json\` if it exists.
2. Read \`.stax/status.json\` if it exists.
3. If the verdict is \`Reject\`, \`Provisional\`, or \`Human review\`, read \`.stax/next-codex-prompt.md\` and treat it as the immediate correction task unless the user explicitly says to ignore STAX for this turn.
4. Include the exact \`STAX_ACK ...\` line from \`.stax/turn-contract.json\` in \`.stax/codex-report.md\`.
5. If \`.stax/turn-contract.json\` is missing, say so in \`.stax/codex-report.md\` and do not claim completion.
6. If \`.stax/task.md\` is blank, write the user's current objective there before editing.
7. Before handoff or a protected boundary, run STAX preflight in observer mode unless the user explicitly asks for soft or hard enforcement.

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

- STAX acknowledgement
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
  await ensureDirectory(path.join(staxPath, "reports"));
  await ensureDirectory(path.join(staxPath, "runtime"));
  await ensureDirectory(path.join(staxPath, "turns"));

  const files: Array<[string, string]> = [
    [
      path.join(staxPath, "config.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-config-v1",
          sidecarProtocolVersion: STAX_SIDECAR_PROTOCOL_VERSION,
          attachedAt: nowIso(),
          repoName: snapshot.repoName,
          repoPath,
          branch: snapshot.branch ?? null,
          commitSha: snapshot.commitSha ?? null,
          requireCodexReportForDiff: true,
          requireFreshCodexTurnCapture: false,
          runtimeFreshnessMode: "normal",
          turnComplianceMode: "normal",
          commandEvidenceStore: "external_user_store",
          commandEvidenceRepoId: externalCommandEvidenceRepoId(repoPath),
          commandEvidenceRoot: displayExternalEvidencePath(externalEvidenceRoot()),
          maxCodexTurnAgeMs: 300000,
          maxSidecarHeartbeatAgeMs: 300000,
          dangerousCommandsRequireAllowRisky: true,
          preflightDefaultBoundary: "local",
          preflightBoundaryPolicy: {
            local: "observer",
            handoff: "soft",
            commit: "soft",
            push: "soft",
            merge: "hard",
            release: "hard",
            deploy: "hard",
            data_publish: "hard",
            ci: "hard"
          },
          preflightEvents: "sidecar_and_external"
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
      path.join(repoPath, STAX_PROOF_REPORT_RELATIVE_PATH),
      defaultProofReportMarkdown(snapshot.repoName, snapshot.branch, snapshot.commitSha)
    ],
    [
      path.join(repoPath, STAX_CONFIDENCE_REPORT_RELATIVE_PATH),
      defaultConfidenceReportMarkdown(snapshot.repoName, snapshot.branch, snapshot.commitSha)
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
  await writeTurnContract({ repoPath });

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
  const next = upsertStaxGitignoreRules(existing);
  if (next === existing) return;
  await fs.writeFile(gitignorePath, next, "utf8");
}

export function upsertStaxGitignoreRules(existing: string): string {
  const normalized = existing.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blockStart = lines.findIndex((line) => line.trim() === STAX_GITIGNORE_BLOCK_HEADER);
  if (blockStart >= 0) {
    let blockEnd = blockStart + 1;
    while (blockEnd < lines.length) {
      const trimmed = lines[blockEnd]?.trim() ?? "";
      if (trimmed === "" || trimmed === ".stax/" || /^!?\.stax(?:\/.*)?$/.test(trimmed)) {
        blockEnd += 1;
        continue;
      }
      break;
    }
    lines.splice(blockStart, blockEnd - blockStart, ...STAX_GITIGNORE_BLOCK_LINES);
    return normalizeGitignoreLines(lines);
  }

  const withoutLegacySidecarIgnore = lines.filter((line) => line.trim() !== ".stax/");
  while (withoutLegacySidecarIgnore.length > 0 && withoutLegacySidecarIgnore.at(-1) === "") {
    withoutLegacySidecarIgnore.pop();
  }
  if (withoutLegacySidecarIgnore.length > 0) withoutLegacySidecarIgnore.push("");
  withoutLegacySidecarIgnore.push(...STAX_GITIGNORE_BLOCK_LINES);
  return normalizeGitignoreLines(withoutLegacySidecarIgnore);
}

function normalizeGitignoreLines(lines: string[]): string {
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
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
    `- Confidence report: ${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`,
    "- Next Codex prompt: .stax/next-codex-prompt.md",
    "- Raw Codex working report: .stax/codex-report.md (local sidecar input)",
    "",
    "## One Next Action",
    "- Write the current task in .stax/task.md or run stax gate when work starts.",
    ""
  ].join("\n");
}

export function defaultConfidenceReportMarkdown(repoName: string, branch?: string, commitSha?: string): string {
  const optionalRepoLines = [
    repoName ? `- Repo: ${repoName}` : "",
    branch ? `- Branch: ${branch}` : "",
    commitSha ? `- Commit: ${commitSha}` : ""
  ].filter(Boolean);
  return [
    "# STAX Confidence Strength Report",
    "",
    "Generated by `stax gate`. This file is the stable repo-tracked confidence-strength summary.",
    "",
    "## Confidence Strength",
    "- No proof-strength artifact has been generated yet.",
    ...optionalRepoLines,
    "",
    "## Evidence Artifacts",
    "- Proof strength JSON: .stax/proof_strength.json",
    `- Proof report: ${STAX_PROOF_REPORT_RELATIVE_PATH}`,
    "",
    "## One Next Action",
    "- Write the current task in .stax/task.md or run stax gate when work starts.",
    ""
  ].join("\n");
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
    return [existing.slice(0, markerIndex).trimEnd(), `${section}${existing.slice(afterEnd)}`].filter(Boolean).join("\n\n");
  }

  return [existing.slice(0, markerIndex).trimEnd(), section].filter(Boolean).join("\n\n");
}
