import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso, readTextIfExists, sidecarDir } from "./SidecarRepo.js";
import { stableHash } from "./WorktreeFingerprint.js";

export const COMMAND_EVIDENCE_LEDGER_FILE = "ledger.jsonl";
export const COMMAND_EVIDENCE_LEDGER_SCHEMA_VERSION = "stax-command-evidence-ledger-v1" as const;

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

export async function appendCommandEvidenceLedgerRecord(input: {
  repoPath: string;
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
  const ledgerPath = commandEvidenceLedgerPath(input.repoPath);
  await ensureDirectory(path.dirname(ledgerPath));
  const records = await readCommandEvidenceLedger(input.repoPath);
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
  return record;
}

export async function readCommandEvidenceLedger(repoPath: string): Promise<CommandEvidenceLedgerRecord[]> {
  const raw = await readTextIfExists(commandEvidenceLedgerPath(repoPath));
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CommandEvidenceLedgerRecord);
}

export function verifyCommandEvidenceLedger(records: CommandEvidenceLedgerRecord[]): CommandEvidenceLedgerVerification {
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
  return {
    valid: issues.length === 0,
    issues,
    recordsByEvidenceId
  };
}

export function commandEvidenceLedgerPath(repoPath: string): string {
  return path.join(sidecarDir(repoPath), "command-evidence", COMMAND_EVIDENCE_LEDGER_FILE);
}

function ledgerRecordHash(record: Omit<CommandEvidenceLedgerRecord, "ledgerHash">): string {
  return stableHash(record);
}
