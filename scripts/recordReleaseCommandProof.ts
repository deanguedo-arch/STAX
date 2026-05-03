import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type CommandSpec = {
  id: string;
  command: string;
  expectedExitCode: number;
};

type CommandResult = {
  id: string;
  command: string;
  cwd: string;
  expectedExitCode: number;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  stdoutTail: string;
  stderrTail: string;
};

type CommandProofPayload = {
  release: string;
  recordedAt: string;
  status: "passed" | "unexpected_exit_code";
  rootDir: string;
  commands: CommandResult[];
};

const STD_TAIL_LIMIT = 14_000;
const DEFAULT_RELEASE = "STAX_Project-Control_9_5_RC4";

const RC4_COMMAND_CHAIN: CommandSpec[] = [
  { id: "typecheck", command: "npm run typecheck", expectedExitCode: 0 },
  { id: "test", command: "npm test", expectedExitCode: 0 },
  { id: "validate_all", command: "npm run validate:all", expectedExitCode: 0 },
  { id: "pr_artifact_integrity", command: "npm run pr-artifact:integrity", expectedExitCode: 0 },
  { id: "pr_artifact_score", command: "npm run pr-artifact:score", expectedExitCode: 0 },
  { id: "pr_artifact_live_trial_refresh", command: "npm run pr-artifact:live-trial:refresh", expectedExitCode: 0 },
  { id: "promotion_gate", command: "npm run campaign:promotion-gate", expectedExitCode: 0 },
  { id: "ci_failure_score", command: "npm run ci-failure:score", expectedExitCode: 0 },
  { id: "pr_review_comment_score", command: "npm run pr-review-comment:score", expectedExitCode: 0 },
  { id: "repo_onboarding_score", command: "npm run repo-onboarding:score", expectedExitCode: 0 },
  { id: "overblock_campaign", command: "npm run campaign:overblock", expectedExitCode: 0 },
  { id: "closed_loop_campaign", command: "npm run campaign:closed-loop", expectedExitCode: 0 },
  { id: "closed_loop_workflow", command: "npm run campaign:closed-loop:workflow", expectedExitCode: 0 },
  { id: "ops_dashboard", command: "npm run stax:ops-dashboard", expectedExitCode: 0 }
];

function tail(text: string): string {
  return text.length > STD_TAIL_LIMIT ? text.slice(-STD_TAIL_LIMIT) : text;
}

function parseReleaseArg(): string {
  const eqArg = process.argv.find((arg) => arg.startsWith("--release="));
  if (eqArg) return eqArg.slice("--release=".length).trim() || DEFAULT_RELEASE;
  const flagIndex = process.argv.indexOf("--release");
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1]?.trim() || DEFAULT_RELEASE;
  }
  return DEFAULT_RELEASE;
}

function runCommand(input: { command: CommandSpec; cwd: string }): Promise<CommandResult> {
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    const child = spawn(input.command.command, {
      cwd: input.cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (exitCode) => {
      resolve({
        id: input.command.id,
        command: input.command.command,
        cwd: input.cwd,
        expectedExitCode: input.command.expectedExitCode,
        exitCode,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr)
      });
    });
  });
}

function toMarkdown(payload: CommandProofPayload): string {
  return [
    `# Command Proof (${payload.release})`,
    "",
    `- Recorded at: ${payload.recordedAt}`,
    `- Root dir: \`${payload.rootDir}\``,
    `- Status: \`${payload.status}\``,
    "",
    "## Summary",
    ...payload.commands.map(
      (entry) =>
        `- ${entry.id}: exit ${entry.exitCode ?? "null"} (expected ${entry.expectedExitCode}) :: \`${entry.command}\``
    ),
    "",
    "## Command Logs",
    ...payload.commands.flatMap((entry) => [
      `### ${entry.id}`,
      "",
      `- CWD: \`${entry.cwd}\``,
      `- Command: \`${entry.command}\``,
      `- Exit code: ${entry.exitCode ?? "null"}`,
      `- Expected exit code: ${entry.expectedExitCode}`,
      `- Started at: ${entry.startedAt}`,
      `- Finished at: ${entry.finishedAt}`,
      "",
      "Stdout tail:",
      "",
      "```text",
      entry.stdoutTail.trim() || "(empty)",
      "```",
      "",
      "Stderr tail:",
      "",
      "```text",
      entry.stderrTail.trim() || "(empty)",
      "```",
      ""
    ])
  ].join("\n");
}

async function main(): Promise<void> {
  const release = parseReleaseArg();
  const rootDir = process.cwd();
  const artifactDir = path.join(rootDir, "docs", "releases", release, "artifacts");
  await fs.mkdir(artifactDir, { recursive: true });

  const commands: CommandResult[] = [];
  for (const command of RC4_COMMAND_CHAIN) {
    commands.push(await runCommand({ command, cwd: rootDir }));
  }

  const status = commands.every((entry) => entry.exitCode === entry.expectedExitCode)
    ? "passed"
    : "unexpected_exit_code";

  const payload: CommandProofPayload = {
    release,
    recordedAt: new Date().toISOString(),
    status,
    rootDir,
    commands
  };

  await fs.writeFile(path.join(artifactDir, "command_proof.json"), JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(path.join(artifactDir, "command_proof.md"), `${toMarkdown(payload)}\n`, "utf8");

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (status !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
