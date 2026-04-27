import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { redactProofText } from "../audit/ProofRedactor.js";

const MAX_STREAM_CHARS = 200 * 1024;
const HALF_STREAM_CHARS = 100 * 1024;

export const CommandEvidenceSchema = z.object({
  commandEvidenceId: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()),
  exitCode: z.number().int(),
  success: z.boolean(),
  source: z.enum(["human_pasted_command_output", "codex_reported_command_output", "local_stax_command_output"]).default("local_stax_command_output"),
  status: z.enum(["passed", "failed", "partial", "unknown"]).default("unknown"),
  commandFamily: z.enum(["typecheck", "test", "e2e", "build", "eval", "regression", "redteam", "unknown"]).default("unknown"),
  counts: z.object({
    filesPassed: z.number().int().nonnegative().optional(),
    testsPassed: z.number().int().nonnegative().optional(),
    testsFailed: z.number().int().nonnegative().optional(),
    suitesPassed: z.number().int().nonnegative().optional(),
    suitesFailed: z.number().int().nonnegative().optional()
  }).optional(),
  stdoutPath: z.string().min(1),
  stderrPath: z.string().min(1),
  stdoutTruncated: z.boolean(),
  stderrTruncated: z.boolean(),
  redactionCount: z.number().int().nonnegative(),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  hash: z.string().min(1),
  workspace: z.string().optional(),
  linkedRepoPath: z.string().optional()
});

export type CommandEvidence = z.infer<typeof CommandEvidenceSchema>;

export type CommandEvidenceInput = {
  command: string;
  args?: string[];
  exitCode: number;
  source?: CommandEvidence["source"];
  status?: CommandEvidence["status"];
  commandFamily?: CommandEvidence["commandFamily"];
  counts?: CommandEvidence["counts"];
  stdout?: string;
  stderr?: string;
  summary: string;
  workspace?: string;
  linkedRepoPath?: string;
};

export class CommandEvidenceStore {
  constructor(private rootDir = process.cwd()) {}

  async record(input: CommandEvidenceInput): Promise<CommandEvidence> {
    const createdAt = new Date().toISOString();
    const date = createdAt.slice(0, 10);
    const commandEvidenceId = `cmd-ev-${createdAt.replace(/[^0-9]/g, "").slice(0, 17)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const dir = path.join(this.rootDir, "evidence", "commands", date);
    await fs.mkdir(dir, { recursive: true });

    const stdout = this.redactAndTruncate(input.stdout ?? "");
    const stderr = this.redactAndTruncate(input.stderr ?? "");
    const stdoutPath = path.join("evidence", "commands", date, `${commandEvidenceId}.stdout.txt`);
    const stderrPath = path.join("evidence", "commands", date, `${commandEvidenceId}.stderr.txt`);
    await Promise.all([
      fs.writeFile(path.join(this.rootDir, stdoutPath), stdout.text, "utf8"),
      fs.writeFile(path.join(this.rootDir, stderrPath), stderr.text, "utf8")
    ]);

    const hash = this.hash({
      command: input.command,
      args: input.args ?? [],
      exitCode: input.exitCode,
      stdout: stdout.text,
      stderr: stderr.text,
      workspace: input.workspace,
      source: input.source ?? "local_stax_command_output"
    });
    const evidence = CommandEvidenceSchema.parse({
      commandEvidenceId,
      command: input.command,
      args: input.args ?? [],
      exitCode: input.exitCode,
      success: input.exitCode === 0,
      source: input.source ?? "local_stax_command_output",
      status: input.status ?? (input.exitCode === 0 ? "passed" : "failed"),
      commandFamily: input.commandFamily ?? commandFamilyFor(input.command),
      counts: input.counts,
      stdoutPath,
      stderrPath,
      stdoutTruncated: stdout.truncated,
      stderrTruncated: stderr.truncated,
      redactionCount: stdout.redactionCount + stderr.redactionCount,
      summary: input.summary,
      createdAt,
      hash,
      workspace: input.workspace,
      linkedRepoPath: input.linkedRepoPath
    });
    await fs.writeFile(path.join(dir, `${commandEvidenceId}.json`), JSON.stringify(evidence, null, 2), "utf8");
    return evidence;
  }

  async list(filter: { workspace?: string; command?: string } = {}): Promise<CommandEvidence[]> {
    const root = path.join(this.rootDir, "evidence", "commands");
    const evidence: CommandEvidence[] = [];
    try {
      const dates = await fs.readdir(root);
      for (const date of dates.sort()) {
        const dir = path.join(root, date);
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) continue;
        const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json")).sort();
        for (const file of files) {
          const item = CommandEvidenceSchema.parse(JSON.parse(await fs.readFile(path.join(dir, file), "utf8")));
          if (filter.workspace && item.workspace !== filter.workspace) continue;
          if (filter.command && item.command !== filter.command) continue;
          evidence.push(item);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return evidence;
  }

  private redactAndTruncate(input: string): { text: string; truncated: boolean; redactionCount: number } {
    const redacted = redactProofText(input);
    const truncated = redacted.text.length > MAX_STREAM_CHARS;
    const text = truncated
      ? [
          redacted.text.slice(0, HALF_STREAM_CHARS),
          "\n[TRUNCATED_COMMAND_OUTPUT]\n",
          redacted.text.slice(-HALF_STREAM_CHARS)
        ].join("")
      : redacted.text;
    return {
      text,
      truncated,
      redactionCount: redacted.redactions.reduce((sum, item) => sum + item.replacements, 0)
    };
  }

  private hash(value: Record<string, unknown>): string {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}

export function commandFamilyFor(command: string): CommandEvidence["commandFamily"] {
  if (/\beval --redteam\b|\b--redteam\b/i.test(command)) return "redteam";
  if (/\beval --regression\b|\b--regression\b/i.test(command)) return "regression";
  if (/\beval\b/i.test(command)) return "eval";
  if (/\btypecheck\b/i.test(command)) return "typecheck";
  if (/\bbuild\b/i.test(command)) return "build";
  if (/\be2e\b|playwright/i.test(command)) return "e2e";
  if (/\btest\b/i.test(command)) return "test";
  return "unknown";
}
