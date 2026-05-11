import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectControlCommandEvidenceEntry } from "../projectControl/ProjectControlEvidencePacket.js";
import { appendCommandEvidenceLedgerRecord, commandEvidenceLedgerPathForDir } from "./CommandEvidenceLedger.js";
import {
  canonicalCommandEvidenceHash,
  COMMAND_EVIDENCE_COLLECTOR_VERSION
} from "./CommandEvidenceVerifier.js";
import {
  ensureExternalCommandEvidenceStore,
  writeCommandEvidencePointer
} from "./ExternalCommandEvidenceStore.js";
import type { SidecarLearningEvent } from "./SidecarLearningEvent.js";
import { writeSidecarLearningEvent } from "./SidecarLearningWriter.js";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  sanitizeId,
  sha256,
  shortHash,
  validateRepoPath
} from "./SidecarRepo.js";
import type { WorktreeFingerprint } from "./WorktreeFingerprint.js";
import { collectWorktreeFingerprint } from "./WorktreeFingerprint.js";

export type CommandEvidenceCollectorOptions = {
  repoPath: string;
  command: string[];
  allowRisky?: boolean;
  writeLearningEvent?: boolean;
};

export type CollectedCommandEvidence = ProjectControlCommandEvidenceEntry & {
  evidenceId: string;
  stdoutPath: string;
  stderrPath: string;
  warning?: string;
  worktreeBefore: WorktreeFingerprint;
  worktreeAfter: WorktreeFingerprint;
  stdoutHash: string;
  stderrHash: string;
  canonicalEvidenceHash: string;
  collectorVersion: typeof COMMAND_EVIDENCE_COLLECTOR_VERSION;
  evidenceStore: "external_user_store";
  externalRepoId: string;
  externalEvidencePath: string;
  externalLedgerPath: string;
  repoPointerPath: string;
};

const DANGEROUS_COMMAND_PATTERNS = [
  /\bdeploy\b/i,
  /\bpublish\b/i,
  /\bsync\b/i,
  /\brm\s+-rf\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bnpm\s+publish\b/i,
  /\bfirebase\s+deploy\b/i,
  /\bvercel\s+deploy\b/i,
  /\bgh\s+release\b/i,
  /\bdocker\s+push\b/i,
  /\bkubectl\s+apply\b/i,
  /\bterraform\s+apply\b/i
];

export function isDangerousSidecarCommand(command: string[]): boolean {
  const joined = command.join(" ");
  return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(joined));
}

export async function collectCommandEvidence(
  options: CommandEvidenceCollectorOptions
): Promise<CollectedCommandEvidence> {
  if (options.command.length === 0) throw new Error("No command supplied after --.");
  const repoPath = await validateRepoPath(options.repoPath);
  const risky = isDangerousSidecarCommand(options.command);
  if (risky && !options.allowRisky) {
    throw new Error("Dangerous command blocked by STAX Sidecar. Re-run with --allow-risky only after human approval.");
  }

  const snapshotBefore = await collectGitSnapshot(repoPath);
  const worktreeBefore = await collectWorktreeFingerprint(repoPath);
  const startedAt = nowIso();
  const { stdout, stderr, exitCode } = await runCommand(repoPath, options.command);
  const finishedAt = nowIso();
  const snapshotAfter = await collectGitSnapshot(repoPath);
  const worktreeAfter = await collectWorktreeFingerprint(repoPath);
  const evidenceId = `cmd_${sanitizeId(`${startedAt}_${shortHash(options.command.join(" "))}`)}`;
  const store = await ensureExternalCommandEvidenceStore(repoPath);
  const commandDir = store.commandEvidenceDir;
  await ensureDirectory(commandDir);
  const stdoutName = `${evidenceId}.stdout.txt`;
  const stderrName = `${evidenceId}.stderr.txt`;
  const jsonName = `${evidenceId}.json`;
  const evidencePath = path.join(commandDir, jsonName);
  const ledgerPath = commandEvidenceLedgerPathForDir(commandDir);
  await fs.writeFile(path.join(commandDir, stdoutName), stdout, "utf8");
  await fs.writeFile(path.join(commandDir, stderrName), stderr, "utf8");

  const evidenceWithoutHash: Omit<CollectedCommandEvidence, "canonicalEvidenceHash"> = {
    evidenceId,
    command: options.command.join(" "),
    cwd: repoPath,
    repo: snapshotAfter.repoName,
    branch: snapshotAfter.branch,
    commitSha: snapshotAfter.commitSha,
    exitCode,
    stdoutPath: stdoutName,
    stderrPath: stderrName,
    worktreeBefore,
    worktreeAfter,
    stdoutHash: sha256(stdout),
    stderrHash: sha256(stderr),
    collectorVersion: COMMAND_EVIDENCE_COLLECTOR_VERSION,
    startedAt,
    finishedAt,
    source: "local_stax_command_output" as const,
    stdout: "",
    stderr: "",
    warning: risky ? "allow-risky used for dangerous command collection" : undefined,
    evidenceStore: "external_user_store",
    externalRepoId: store.repoId,
    externalEvidencePath: evidencePath,
    externalLedgerPath: ledgerPath,
    repoPointerPath: path.join(repoPath, ".stax", "command-evidence", `${evidenceId}.pointer.json`)
  };
  const evidence: CollectedCommandEvidence = {
    ...evidenceWithoutHash,
    canonicalEvidenceHash: canonicalCommandEvidenceHash(evidenceWithoutHash)
  };
  await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await appendCommandEvidenceLedgerRecord({
    commandEvidenceDir: commandDir,
    evidenceId,
    evidencePath: jsonName,
    stdoutPath: stdoutName,
    stderrPath: stderrName,
    evidenceHash: evidence.canonicalEvidenceHash,
    stdoutHash: evidence.stdoutHash,
    stderrHash: evidence.stderrHash,
    worktreeBeforeHash: evidence.worktreeBefore.fingerprintHash,
    worktreeAfterHash: evidence.worktreeAfter.fingerprintHash,
    recordedAt: finishedAt
  });
  await writeCommandEvidencePointer({
    repoPath,
    store,
    evidenceId,
    evidencePath,
    stdoutPath: path.join(commandDir, stdoutName),
    stderrPath: path.join(commandDir, stderrName),
    ledgerPath,
    worktreeAfterHash: evidence.worktreeAfter.fingerprintHash,
    canonicalEvidenceHash: evidence.canonicalEvidenceHash,
    recordedAt: finishedAt
  });

  if (options.writeLearningEvent ?? true) {
    await writeSidecarLearningEvent(repoPath, commandEvidenceLearningEvent(repoPath, evidence, snapshotBefore.repoName));
  }

  return evidence;
}

function runCommand(cwd: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const resolvedCommand = resolveCollectCommand(command);
    const child = spawn(resolvedCommand.executable, resolvedCommand.args, {
      cwd,
      shell: false,
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

function resolveCollectCommand(command: string[]): { executable: string; args: string[] } {
  const executable = command[0]!;
  const args = command.slice(1);
  if (process.platform === "win32" && /^(npm|npm\.cmd)$/i.test(executable)) {
    const npmExecPath = process.env.npm_execpath?.trim();
    if (npmExecPath) {
      return {
        executable: process.execPath,
        args: [npmExecPath, ...args]
      };
    }
    return { executable: "npm.cmd", args };
  }
  return { executable, args };
}

function commandEvidenceLearningEvent(
  repoPath: string,
  evidence: CollectedCommandEvidence,
  repoName: string
): SidecarLearningEvent {
  return {
    eventId: `evt_${sanitizeId(`command_evidence_${evidence.evidenceId}`)}`,
    eventType: "command_evidence_collected",
    schemaVersion: "sidecar-learning-v1",
    createdAt: evidence.finishedAt ?? nowIso(),
    sourceRepo: {
      name: repoName,
      pathHash: sha256(repoPath),
      commitSha: evidence.commitSha,
      branch: evidence.branch
    },
    task: {
      taskId: "command_evidence",
      objective: evidence.command,
      finalOutcome: evidence.exitCode === 0 ? "command_recorded_success" : "command_recorded_failure"
    },
    stax: {
      verdict: evidence.exitCode === 0 ? "Accept" : "Reject",
      useful: true,
      falseAccept: false,
      falseBlock: false,
      usefulBlock: evidence.exitCode !== 0,
      verifiedAccept: evidence.exitCode === 0
    },
    evidence: {
      changedFileRoles: [],
      commandProofStrengths: [evidence.exitCode === 0 ? "local_command_exit_0" : "local_command_failed"],
      claimTypes: ["command_evidence"],
      failurePatternIds: evidence.exitCode === 0 ? [] : ["failed_command_recorded_not_hidden"]
    },
    promotion: {
      suggested: false,
      target: "none",
      scope: "none",
      rationale: ""
    },
    privacy: {
      redactionStatus: "clean",
      redactionNotes: []
    }
  };
}
