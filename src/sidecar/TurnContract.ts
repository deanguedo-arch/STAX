import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, readTextIfExists, sha256, sidecarDir, validateRepoPath } from "./SidecarRepo.js";

export type StaxTurnContract = {
  schemaVersion: "stax-turn-contract-v1";
  turnId: string;
  generatedAt: string;
  statusHash: string;
  nextPromptHash: string;
  requiredAcknowledgement: string;
  requiredFilesRead: string[];
  expiresAt?: string;
};

export type WriteTurnContractOptions = {
  repoPath: string;
  now?: Date;
  turnIdSuffix?: string;
  expiresAt?: Date;
};

function shortContentHash(content: string): string {
  return sha256(content).slice(0, 8);
}

function safeTurnTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

function generateTurnId(now: Date, suffix?: string): string {
  const normalizedSuffix = suffix ?? randomBytes(2).toString("hex");
  return `turn_${safeTurnTimestamp(now)}_${normalizedSuffix}`;
}

export async function readTurnContract(repoPathInput: string): Promise<StaxTurnContract | null> {
  const repoPath = await validateRepoPath(repoPathInput);
  const raw = await readTextIfExists(path.join(sidecarDir(repoPath), "turn-contract.json"));
  if (!raw.trim()) return null;
  const parsed = JSON.parse(raw) as StaxTurnContract;
  return parsed;
}

export async function writeTurnContract(options: WriteTurnContractOptions): Promise<StaxTurnContract> {
  const repoPath = await validateRepoPath(options.repoPath);
  const staxPath = sidecarDir(repoPath);
  const now = options.now ?? new Date();
  const statusRaw = await readTextIfExists(path.join(staxPath, "status.json"));
  const nextPromptRaw = await readTextIfExists(path.join(staxPath, "next-codex-prompt.md"));
  const statusHash = shortContentHash(statusRaw);
  const nextPromptHash = shortContentHash(nextPromptRaw);
  const turnId = generateTurnId(now, options.turnIdSuffix);
  const contract: StaxTurnContract = {
    schemaVersion: "stax-turn-contract-v1",
    turnId,
    generatedAt: now.toISOString(),
    statusHash,
    nextPromptHash,
    requiredAcknowledgement: `STAX_ACK ${turnId} ${statusHash} ${nextPromptHash}`,
    requiredFilesRead: [".stax/turn-contract.json", ".stax/status.json", ".stax/next-codex-prompt.md"],
    ...(options.expiresAt ? { expiresAt: options.expiresAt.toISOString() } : {})
  };

  await ensureDirectory(staxPath);
  await fs.writeFile(path.join(staxPath, "turn-contract.json"), `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  return contract;
}
