import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendCommandEvidenceLedgerRecord,
  commandEvidenceLedgerPathForDir,
  readCommandEvidenceLedgerFromDir,
  verifyCommandEvidenceLedger
} from "../src/sidecar/CommandEvidenceLedger.js";

describe("command evidence ledger", () => {
  it("serializes concurrent appends without breaking the hash chain", async () => {
    const commandEvidenceDir = await tempCommandEvidenceDir("stax-command-ledger-concurrent-");

    await Promise.all([
      appendRecord(commandEvidenceDir, "cmd_a"),
      appendRecord(commandEvidenceDir, "cmd_b")
    ]);

    const records = await readCommandEvidenceLedgerFromDir(commandEvidenceDir);
    const verification = verifyCommandEvidenceLedger(records);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.sequence).sort()).toEqual([1, 2]);
    expect(verification.valid).toBe(true);
  });

  it("archives an invalid ledger before appending a new record", async () => {
    const commandEvidenceDir = await tempCommandEvidenceDir("stax-command-ledger-corrupt-");
    await appendRecord(commandEvidenceDir, "cmd_old");
    const ledgerPath = commandEvidenceLedgerPathForDir(commandEvidenceDir);
    const [oldRecord] = await readCommandEvidenceLedgerFromDir(commandEvidenceDir);
    await fs.writeFile(ledgerPath, `${JSON.stringify({ ...oldRecord, sequence: 99 })}\n`, "utf8");

    await appendRecord(commandEvidenceDir, "cmd_new");

    const files = await fs.readdir(commandEvidenceDir);
    const records = await readCommandEvidenceLedgerFromDir(commandEvidenceDir);
    const verification = verifyCommandEvidenceLedger(records);
    expect(files.some((file) => file.startsWith("ledger.jsonl.corrupt-"))).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0]?.evidenceId).toBe("cmd_new");
    expect(records[0]?.sequence).toBe(1);
    expect(verification.valid).toBe(true);
  });
});

async function tempCommandEvidenceDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const commandEvidenceDir = path.join(dir, "command-evidence");
  await fs.mkdir(commandEvidenceDir, { recursive: true });
  return commandEvidenceDir;
}

async function appendRecord(commandEvidenceDir: string, evidenceId: string) {
  return appendCommandEvidenceLedgerRecord({
    commandEvidenceDir,
    evidenceId,
    evidencePath: `${evidenceId}.json`,
    stdoutPath: `${evidenceId}.stdout.txt`,
    stderrPath: `${evidenceId}.stderr.txt`,
    evidenceHash: `evidence-${evidenceId}`,
    stdoutHash: `stdout-${evidenceId}`,
    stderrHash: `stderr-${evidenceId}`,
    worktreeBeforeHash: `before-${evidenceId}`,
    worktreeAfterHash: `after-${evidenceId}`,
    recordedAt: `2026-05-13T00:00:0${evidenceId === "cmd_a" ? "1" : "2"}.000Z`
  });
}
