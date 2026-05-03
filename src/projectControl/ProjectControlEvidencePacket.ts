import { z } from "zod";

const EvidenceChangeTypeSchema = z.enum(["added", "modified", "deleted", "renamed"]);
const EvidenceFileRoleSchema = z.enum([
  "source",
  "test",
  "docs",
  "fixture",
  "config",
  "generated",
  "lockfile",
  "script",
  "migration",
  "visual_style",
  "unknown"
]);

const CommandEvidenceSourceSchema = z.enum([
  "local_stax_command_output",
  "human_pasted_command_output",
  "codex_reported_command_output",
  "ci_workflow_output",
  "non_execution_evidence"
]);

export const ProjectControlChangedFileSchema = z.object({
  path: z.string().min(1),
  changeType: EvidenceChangeTypeSchema,
  fileRole: EvidenceFileRoleSchema.optional(),
  patch: z.string().optional(),
  oldPath: z.string().optional(),
  newPath: z.string().optional()
});

export const ProjectControlCommandEvidenceEntrySchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  exitCode: z.number().int().nullable().optional(),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  source: CommandEvidenceSourceSchema.default("local_stax_command_output")
});

export const ProjectControlVisualEvidenceSchema = z.object({
  path: z.string().min(1).optional(),
  description: z.string().min(1),
  capturedAt: z.string().datetime().optional(),
  source: z.enum(["rendered_screenshot", "manual_visual_checklist", "playwright_trace"]).default("rendered_screenshot")
});

export const ProjectControlHumanApprovalSchema = z.object({
  approvedBy: z.string().min(1),
  approvalReason: z.string().min(1),
  sourceRun: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional()
});

export const StructuredProjectControlEvidencePacketSchema = z.object({
  task: z.string().min(1),
  repo: z.string().optional(),
  targetRepoPath: z.string().optional(),
  branch: z.string().optional(),
  baseSha: z.string().optional(),
  headSha: z.string().optional(),
  gitStatusShort: z.string().optional(),
  changedFiles: z.array(ProjectControlChangedFileSchema).default([]),
  unifiedDiff: z.string().optional(),
  commandEvidence: z.array(ProjectControlCommandEvidenceEntrySchema).default([]),
  codexReport: z.string().default(""),
  visualEvidence: z.array(ProjectControlVisualEvidenceSchema).default([]),
  humanApproval: z.array(ProjectControlHumanApprovalSchema).default([])
});

export type StructuredProjectControlEvidencePacket = z.infer<typeof StructuredProjectControlEvidencePacketSchema>;
export type ProjectControlChangedFile = z.infer<typeof ProjectControlChangedFileSchema>;
export type ProjectControlCommandEvidenceEntry = z.infer<typeof ProjectControlCommandEvidenceEntrySchema>;
export type ProjectControlVisualEvidence = z.infer<typeof ProjectControlVisualEvidenceSchema>;
export type ProjectControlHumanApproval = z.infer<typeof ProjectControlHumanApprovalSchema>;

export type ProjectControlPacket = {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
  structured?: StructuredProjectControlEvidencePacket;
};

export function parseProjectControlPacket(input: string): ProjectControlPacket {
  const structured = parseStructuredProjectControlPacket(input);
  if (structured) {
    return {
      task: structured.task,
      repoEvidence: renderStructuredRepoEvidence(structured),
      commandEvidence: renderStructuredCommandEvidence(structured),
      codexReport: structured.codexReport,
      structured
    };
  }

  const task =
    extractLabeledBlock(input, "Task", ["Repo Evidence", "Command Evidence", "Codex Report", "Return"]) ||
    input.trim();
  let codexReport = extractLabeledBlock(input, "Codex Report", ["Return"]);
  if (!codexReport) {
    const inlineCodexReport = task.match(/audit this codex report[^:]*:\s*([\s\S]+)/i)?.[1];
    if (inlineCodexReport) codexReport = inlineCodexReport.trim();
  }

  return {
    task,
    repoEvidence: extractLabeledBlock(input, "Repo Evidence", ["Command Evidence", "Codex Report", "Return"]),
    commandEvidence: extractLabeledBlock(input, "Command Evidence", ["Codex Report", "Return"]),
    codexReport
  };
}

export function stringifyProjectControlEvidencePacket(
  packet: StructuredProjectControlEvidencePacket
): string {
  return JSON.stringify(packet, null, 2);
}

function parseStructuredProjectControlPacket(input: string): StructuredProjectControlEvidencePacket | undefined {
  const candidates = [input.trim(), extractJsonFence(input)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const result = StructuredProjectControlEvidencePacketSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // keep trying
    }
  }
  return undefined;
}

function extractJsonFence(input: string): string | undefined {
  const match = input.match(/```json\s*([\s\S]*?)```/i);
  return match?.[1]?.trim();
}

function renderStructuredRepoEvidence(packet: StructuredProjectControlEvidencePacket): string {
  const lines: string[] = [];
  if (packet.repo) lines.push(`Repo: ${packet.repo}`);
  if (packet.targetRepoPath) lines.push(`Target repo path: ${packet.targetRepoPath}`);
  if (packet.branch) lines.push(`Target branch: ${packet.branch}`);
  if (packet.headSha) lines.push(`Target commit: ${packet.headSha}`);
  if (packet.baseSha) lines.push(`Base commit: ${packet.baseSha}`);
  if (packet.gitStatusShort) lines.push(`Git status short:\n${packet.gitStatusShort}`);
  if (packet.changedFiles.length > 0) {
    lines.push(
      "Changed files:\n" +
        packet.changedFiles
          .map((file) => {
            const parts = [file.path, file.changeType];
            if (file.fileRole) parts.push(file.fileRole);
            return `- ${parts.join(" | ")}`;
          })
          .join("\n")
    );
  }
  if (packet.unifiedDiff) lines.push(`Unified diff:\n${packet.unifiedDiff}`);
  if (packet.visualEvidence.length > 0) {
    lines.push(
      "Visual evidence:\n" +
        packet.visualEvidence
          .map((item) =>
            `- ${item.source}: ${[item.path, item.description, item.capturedAt].filter(Boolean).join(" | ")}`
          )
          .join("\n")
    );
  }
  if (packet.humanApproval.length > 0) {
    lines.push(
      "Human approval:\n" +
        packet.humanApproval
          .map((item) =>
            `- approvedBy=${item.approvedBy} | approvalReason=${item.approvalReason}` +
            `${item.sourceRun ? ` | sourceRun=${item.sourceRun}` : ""}` +
            `${item.approvedAt ? ` | approvedAt=${item.approvedAt}` : ""}`
          )
          .join("\n")
    );
  }
  return lines.join("\n");
}

function renderStructuredCommandEvidence(packet: StructuredProjectControlEvidencePacket): string {
  if (packet.commandEvidence.length === 0) return "";
  return packet.commandEvidence
    .map((entry) => {
      const header = [
        entry.cwd ? `cwd=${entry.cwd}` : undefined,
        entry.repo ? `repo=${entry.repo}` : undefined,
        entry.branch ? `branch=${entry.branch}` : undefined,
        entry.commitSha ? `commitSha=${entry.commitSha}` : undefined,
        `$ ${entry.command}`,
        entry.exitCode !== undefined && entry.exitCode !== null ? `Exit code: ${entry.exitCode}` : undefined,
        entry.startedAt ? `startedAt=${entry.startedAt}` : undefined,
        entry.finishedAt ? `finishedAt=${entry.finishedAt}` : undefined,
        `source=${entry.source}`
      ]
        .filter(Boolean)
        .join("\n");
      return [header, entry.stdout, entry.stderr].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function extractLabeledBlock(input: string, label: string, followingLabels: string[]): string {
  const start = input.search(new RegExp(`^${escapeRegExp(label)}:\\s*`, "im"));
  if (start === -1) return "";
  const afterLabel = input.slice(start).replace(new RegExp(`^${escapeRegExp(label)}:\\s*`, "i"), "");
  const nextPositions = followingLabels
    .map((next) => afterLabel.search(new RegExp(`\\n${escapeRegExp(next)}:\\s*`, "i")))
    .filter((index) => index >= 0);
  const end = nextPositions.length ? Math.min(...nextPositions) : afterLabel.length;
  return afterLabel.slice(0, end).trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
