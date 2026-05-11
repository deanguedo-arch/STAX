import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso, readTextIfExists, sidecarDir } from "./SidecarRepo.js";
import { stableHash } from "./WorktreeFingerprint.js";

export const COMMAND_EVIDENCE_LEDGER_FILE = "ledger.jsonl";
export const COMMAND_EVIDENCE_LEDGER_TIP_FILE = "ledger-tip.json";
export const COMMAND_EVIDENCE_LEDGER_SCHEMA_VERSION = "stax-command-evidence-ledger-v1" as const;
export const COMMAND_EVIDENCE_LEDGER_TIP_SCHEMA_VERSION = "stax-command-evidence-ledger-tip-v1" as const;

export type CommandEvidenceLedgerRecord = {
  schemaVersion: typeof COMMAND_EVIDENCE_LEDGER_SCHEMA_VERSION;
  sequence: number;
  evidenceId: string;
  evidencePath: string;
  stdoutPath: string;
  stderrPath: string;
  evidenceHash: string;
  stdoutHash: string;
  stderrHash: string;
  worktreeBeforeHash: string;
  worktreeAfterHash: string;
  previousLedgerHash: string | null;
  ledgerHash: string;
  recordedAt: string;
};

export type CommandEvidenceLedgerVerification = {
  valid: boolean;
  issues: string[];
  recordsByEvidenceId: Map<string, CommandEvidenceLedgerRecord>;
};

export type CommandEvidenceLedgerTip = {
  schemaVersion: typeof COMMAND_EVIDENCE_LEDGER_TIP_SCHEMA_VERSION;
  sequence: number;
  evidenceId: string;
  ledgerHash: string;
  commandEvidenceDirHash: string;
  updatedAt: string;
};

export async function appendCommandEvidenceLedgerRecord(input: {
  repoPath?: string;
  commandEvidenceDir?: string;
  evidenceId: string;
  evidencePath: string;
  stdoutPath: string;
  stderrPath: string;
  evidenceHash: string;
  stdoutHash: string;
  stderrHash: string;
  worktreeBeforeHash: string;
  worktreeAfterHash: string;
  recordedAt?: string;
}): Promise<CommandEvidenceLedgerRecord> {
  const ledgerPath = input.commandEvidenceDir
    ? commandEvidenceLedgerPathForDir(input.commandEvidenceDir)
    : commandEvidenceLedgerPath(requiredRepoPath(input.repoPath));
  await ensureDirectory(path.dirname(ledgerPath));
  const records = input.commandEvidenceDir
    ? await readCommandEvidenceLedgerFromDir(input.commandEvidenceDir)
    : await readCommandEvidenceLedger(requiredRepoPath(input.repoPath));
  const previous = records.at(-1);
  const recordWithoutHash: Omit<CommandEvidenceLedgerRecord, "ledgerHash"> = {
    schemaVersion: COMMAND_EVIDENCE_LEDGER_SCHEMA_VERSION,
    sequence: previous ? previous.sequence + 1 : 1,
    evidenceId: input.evidenceId,
    evidencePath: input.evidencePath,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    evidenceHash: input.evidenceHash,
    stdoutHash: input.stdoutHash,
    stderrHash: input.stderrHash,
    worktreeBeforeHash: input.worktreeBeforeHash,
    worktreeAfterHash: input.worktreeAfterHash,
    previousLedgerHash: previous?.ledgerHash ?? null,
    recordedAt: input.recordedAt ?? nowIso()
  };
  const record: CommandEvidenceLedgerRecord = {
    ...recordWithoutHash,
    ledgerHash: ledgerRecordHash(recordWithoutHash)
  };
  await fs.appendFile(ledgerPath, `${JSON.stringify(record)}\n`, "utf8");
  if (input.commandEvidenceDir) {
    await writeCommandEvidenceLedgerTipForDir(input.commandEvidenceDir, record);
  }
  return record;
}

export async function readCommandEvidenceLedger(repoPath: string): Promise<CommandEvidenceLedgerRecord[]> {
  const raw = await readTextIfExists(commandEvidenceLedgerPath(repoPath));
  return parseCommandEvidenceLedger(raw);
}

export async function readCommandEvidenceLedgerFromDir(commandEvidenceDir: string): Promise<CommandEvidenceLedgerRecord[]> {
  const raw = await readTextIfExists(commandEvidenceLedgerPathForDir(commandEvidenceDir));
  return parseCommandEvidenceLedger(raw);
}

export async function readCommandEvidenceLedgerTipFromDir(commandEvidenceDir: string): Promise<CommandEvidenceLedgerTip | undefined> {
  const raw = await readTextIfExists(commandEvidenceLedgerTipPathForDir(commandEvidenceDir));
  if (!raw.trim()) return undefined;
  return JSON.parse(raw) as CommandEvidenceLedgerTip;
}

export async function writeCommandEvidenceLedgerTipForDir(
  commandEvidenceDir: string,
  record: Pick<CommandEvidenceLedgerRecord, "sequence" | "evidenceId" | "ledgerHash" | "recordedAt">
): Promise<CommandEvidenceLedgerTip> {
  const tip: CommandEvidenceLedgerTip = {
    schemaVersion: COMMAND_EVIDENCE_LEDGER_TIP_SCHEMA_VERSION,
    sequence: record.sequence,
    evidenceId: record.evidenceId,
    ledgerHash: record.ledgerHash,
    commandEvidenceDirHash: stableHash(path.resolve(commandEvidenceDir)),
    updatedAt: record.recordedAt
  };
  const tipPath = commandEvidenceLedgerTipPathForDir(commandEvidenceDir);
  await ensureDirectory(path.dirname(tipPath));
  await fs.writeFile(tipPath, `${JSON.stringify(tip, null, 2)}\n`, "utf8");
  return tip;
}

function parseCommandEvidenceLedger(raw: string): CommandEvidenceLedgerRecord[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CommandEvidenceLedgerRecord);
}

export function verifyCommandEvidenceLedger(
  records: CommandEvidenceLedgerRecord[],
  options: { ledgerTip?: CommandEvidenceLedgerTip; requireLedgerTip?: boolean; commandEvidenceDir?: string } = {}
): CommandEvidenceLedgerVerification {
  const issues: string[] = [];
  const recordsByEvidenceId = new Map<string, CommandEvidenceLedgerRecord>();
  let previousHash: string | null = null;
  for (const [index, record] of records.entries()) {
    const expectedSequence = index + 1;
    if (record.schemaVersion !== COMMAND_EVIDENCE_LEDGER_SCHEMA_VERSION) {
      issues.push(`ledger record ${expectedSequence} has unsupported schema ${record.schemaVersion}.`);
    }
    if (record.sequence !== expectedSequence) {
      issues.push(`ledger record ${record.evidenceId} has sequence ${record.sequence}, expected ${expectedSequence}.`);
    }
    if (record.previousLedgerHash !== previousHash) {
      issues.push(`ledger record ${record.evidenceId} previous hash does not match the chain.`);
    }
    const { ledgerHash: _ledgerHash, ...withoutHash } = record;
    const expectedLedgerHash = ledgerRecordHash(withoutHash);
    if (record.ledgerHash !== expectedLedgerHash) {
      issues.push(`ledger record ${record.evidenceId} hash does not verify.`);
    }
    if (recordsByEvidenceId.has(record.evidenceId)) {
      issues.push(`ledger contains duplicate evidence id ${record.evidenceId}.`);
    }
    recordsByEvidenceId.set(record.evidenceId, record);
    previousHash = record.ledgerHash;
  }
  const latest = records.at(-1);
  if (options.requireLedgerTip && !options.ledgerTip) {
    issues.push("external command evidence ledger tip is missing.");
  }
  if (options.ledgerTip) {
    if (options.ledgerTip.schemaVersion !== COMMAND_EVIDENCE_LEDGER_TIP_SCHEMA_VERSION) {
      issues.push(`external command evidence ledger tip has unsupported schema ${options.ledgerTip.schemaVersion}.`);
    }
    if (!latest) {
      issues.push("external command evidence ledger tip exists but the ledger is empty.");
    } else {
      if (options.ledgerTip.sequence !== latest.sequence) {
        issues.push(`external command evidence ledger tip sequence ${options.ledgerTip.sequence} does not match latest ledger sequence ${latest.sequence}.`);
      }
      if (options.ledgerTip.evidenceId !== latest.evidenceId) {
        issues.push(`external command evidence ledger tip evidence id ${options.ledgerTip.evidenceId} does not match latest ledger evidence id ${latest.evidenceId}.`);
      }
      if (options.ledgerTip.ledgerHash !== latest.ledgerHash) {
        issues.push("external command evidence ledger tip does not match the latest ledger hash.");
      }
    }
    if (options.commandEvidenceDir) {
      const expectedDirHash = stableHash(path.resolve(options.commandEvidenceDir));
      if (options.ledgerTip.commandEvidenceDirHash !== expectedDirHash) {
        issues.push("external command evidence ledger tip does not match this command evidence directory.");
      }
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    recordsByEvidenceId
  };
}

export function commandEvidenceLedgerPath(repoPath: string): string {
  return path.join(sidecarDir(repoPath), "command-evidence", COMMAND_EVIDENCE_LEDGER_FILE);
}

export function commandEvidenceLedgerPathForDir(commandEvidenceDir: string): string {
  return path.join(commandEvidenceDir, COMMAND_EVIDENCE_LEDGER_FILE);
}

export function commandEvidenceLedgerTipPathForDir(commandEvidenceDir: string): string {
  return path.join(path.dirname(commandEvidenceDir), COMMAND_EVIDENCE_LEDGER_TIP_FILE);
}

function requiredRepoPath(repoPath: string | undefined): string {
  if (!repoPath) throw new Error("repoPath or commandEvidenceDir is required for command evidence ledger access.");
  return repoPath;
}

function ledgerRecordHash(record: Omit<CommandEvidenceLedgerRecord, "ledgerHash">): string {
  return stableHash(record);
}
