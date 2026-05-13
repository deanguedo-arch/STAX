import fs from "node:fs/promises";
import path from "node:path";
import { SidecarLearningEventSchema, type SidecarLearningEvent } from "./SidecarLearningEvent.js";
import { redactSidecarLearningEvent } from "./SidecarRedactor.js";
import { ensureDirectory, nowIso, readTextIfExists, sidecarDir } from "./SidecarRepo.js";

export type WriteSidecarLearningEventResult = {
  written: boolean;
  event?: SidecarLearningEvent;
  eventPath?: string;
  reason?: string;
};

export async function writeSidecarLearningEvent(
  repoPath: string,
  event: SidecarLearningEvent
): Promise<WriteSidecarLearningEventResult> {
  const redacted = redactSidecarLearningEvent(event);
  const parsed = SidecarLearningEventSchema.parse(redacted);
  if (parsed.privacy.redactionStatus === "blocked") {
    return {
      written: false,
      reason: "privacy_blocked"
    };
  }

  const staxPath = sidecarDir(repoPath);
  const eventsDir = path.join(staxPath, "events");
  await ensureDirectory(eventsDir);
  const eventPath = path.join(eventsDir, `${parsed.eventId}.json`);
  await fs.writeFile(eventPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await appendLearningLedger(staxPath, parsed);
  return {
    written: true,
    event: parsed,
    eventPath
  };
}

async function appendLearningLedger(staxPath: string, event: SidecarLearningEvent): Promise<void> {
  await withLearningLedgerLock(staxPath, async () => {
    await appendLearningLedgerUnlocked(staxPath, event);
  });
}

async function appendLearningLedgerUnlocked(staxPath: string, event: SidecarLearningEvent): Promise<void> {
  const ledgerPath = path.join(staxPath, "learning-ledger.json");
  const raw = await readTextIfExists(ledgerPath);
  const ledger = raw ? await parseLearningLedgerOrArchive(ledgerPath, raw) : { schemaVersion: "stax-sidecar-learning-ledger-v1", events: [] };
  const events = Array.isArray(ledger.events) ? ledger.events : [];
  const withoutExisting = events.filter((item) => item.eventId !== event.eventId);
  await writeJsonFileAtomic(
    ledgerPath,
    {
      schemaVersion: "stax-sidecar-learning-ledger-v1",
      updatedAt: nowIso(),
      events: [...withoutExisting, event]
    }
  );
}

async function parseLearningLedgerOrArchive(
  ledgerPath: string,
  raw: string
): Promise<{ schemaVersion?: string; updatedAt?: string; events?: SidecarLearningEvent[] }> {
  try {
    return JSON.parse(raw) as { schemaVersion?: string; updatedAt?: string; events?: SidecarLearningEvent[] };
  } catch {
    const corruptPath = `${ledgerPath}.corrupt-${Date.now()}`;
    await fs.writeFile(corruptPath, raw, "utf8");
    return { schemaVersion: "stax-sidecar-learning-ledger-v1", events: [] };
  }
}

async function writeJsonFileAtomic(filePath: string, payload: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function withLearningLedgerLock(staxPath: string, fn: () => Promise<void>): Promise<void> {
  const lockPath = path.join(staxPath, "learning-ledger.lock");
  let handle: fs.FileHandle | undefined;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      handle = await fs.open(lockPath, "wx");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await sleep(25);
    }
  }

  if (!handle) {
    throw new Error("Timed out waiting for sidecar learning ledger lock.");
  }

  try {
    await fn();
  } finally {
    await handle.close();
    await fs.rm(lockPath, { force: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
