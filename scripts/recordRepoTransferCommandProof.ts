import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type CommandProof = {
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

type ProofProfile = "hygiene" | "clean";

function parseArgs(): { runId: string; profile: ProofProfile } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  const profileEq = process.argv.find((arg) => arg.startsWith("--profile="));
  const profileIndex = process.argv.indexOf("--profile");
  const profile = profileEq?.slice("--profile=".length).trim() || (profileIndex >= 0 ? process.argv[profileIndex + 1]?.trim() : "hygiene");
  if (profile !== "hygiene" && profile !== "clean") {
    throw new Error("Invalid --profile. Expected hygiene or clean.");
  }
  return { runId, profile };
}

function tail(text: string): string {
  return text.length > 12_000 ? text.slice(-12_000) : text;
}

function runCommand(input: { id: string; command: string; expectedExitCode: number; cwd: string }): Promise<CommandProof> {
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    const child = spawn(input.command, {
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
        id: input.id,
        command: input.command,
        cwd: input.cwd,
        expectedExitCode: input.expectedExitCode,
        exitCode,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr)
      });
    });
  });
}

function formatMarkdown(input: { runId: string; proofs: CommandProof[] }): string {
  return [
    `# Repo Transfer Command Proof: ${input.runId}`,
    "",
    "## Summary",
    ...input.proofs.map((proof) => `- ${proof.id}: exit ${proof.exitCode}, expected ${proof.expectedExitCode}`),
    "",
    "## Commands",
    ...input.proofs.flatMap((proof) => [
      `### ${proof.id}`,
      "",
      `- CWD: \`${proof.cwd}\``,
      `- Command: \`${proof.command}\``,
      `- Exit code: ${proof.exitCode}`,
      `- Expected exit code: ${proof.expectedExitCode}`,
      `- Started at: ${proof.startedAt}`,
      `- Finished at: ${proof.finishedAt}`,
      "",
      "Stdout tail:",
      "",
      "```text",
      proof.stdoutTail.trim() || "(empty)",
      "```",
      "",
      "Stderr tail:",
      "",
      "```text",
      proof.stderrTail.trim() || "(empty)",
      "```",
      ""
    ])
  ].join("\n");
}

const { runId, profile } = parseArgs();
const cwd = process.cwd();
const hygieneCommands = [
  { id: "git_status", command: "git status --short", expectedExitCode: 0, cwd },
  { id: "capture_hygiene", command: `npm run repo-transfer:capture-hygiene -- --run ${runId}`, expectedExitCode: 0, cwd },
  { id: "comparison_integrity_expected_fail", command: `npm run campaign:integrity -- --run ${runId}`, expectedExitCode: 1, cwd },
  { id: "score_run_expected_fail", command: `npm run repo-transfer:score-run -- --run ${runId}`, expectedExitCode: 1, cwd }
];
const cleanCommands = [
  { id: "git_status", command: "git status --short", expectedExitCode: 0, cwd },
  { id: "capture_hygiene_clean", command: `npm run repo-transfer:capture-hygiene -- --run ${runId} --expect-clean`, expectedExitCode: 0, cwd },
  { id: "comparison_integrity", command: `npm run campaign:integrity -- --run ${runId}`, expectedExitCode: 0, cwd },
  { id: "score_run_write", command: `npm run repo-transfer:score-run -- --run ${runId} --write`, expectedExitCode: 0, cwd },
  { id: "repo_transfer_integrity", command: "npm run repo-transfer:integrity", expectedExitCode: 0, cwd },
  { id: "typecheck", command: "npm run typecheck", expectedExitCode: 0, cwd },
  { id: "test", command: "npm test", expectedExitCode: 0, cwd },
  { id: "rax_eval", command: "npm run rax -- eval", expectedExitCode: 0, cwd },
  {
    id: "fitness_smoke",
    command: "npm run rax -- run \"Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes.\"",
    expectedExitCode: 0,
    cwd
  }
];
const commands = profile === "clean" ? cleanCommands : hygieneCommands;
const proofs = [];
for (const command of commands) {
  proofs.push(await runCommand(command));
}

const runDir = path.join(cwd, "fixtures", "real_use", "runs", runId);
const payload = {
  status: proofs.every((proof) => proof.exitCode === proof.expectedExitCode) ? "passed" : "unexpected_exit_code",
  runId,
  profile,
  recordedAt: new Date().toISOString(),
  proofs
};
await fs.writeFile(path.join(runDir, "command_proof.json"), JSON.stringify(payload, null, 2), "utf8");
await fs.writeFile(path.join(runDir, "command_proof.md"), `${formatMarkdown({ runId, proofs })}\n`, "utf8");

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
if (payload.status !== "passed") process.exitCode = 1;
