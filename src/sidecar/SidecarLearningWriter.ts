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
  const ledgerPath = path.join(staxPath, "learning-ledger.json");
  const raw = await readTextIfExists(ledgerPath);
  const ledger = raw
    ? (JSON.parse(raw) as { schemaVersion?: string; updatedAt?: string; events?: SidecarLearningEvent[] })
    : { schemaVersion: "stax-sidecar-learning-ledger-v1", events: [] };
  const events = Array.isArray(ledger.events) ? ledger.events : [];
  const withoutExisting = events.filter((item) => item.eventId !== event.eventId);
  await fs.writeFile(
    ledgerPath,
    `${JSON.stringify(
      {
        schemaVersion: "stax-sidecar-learning-ledger-v1",
        updatedAt: nowIso(),
        events: [...withoutExisting, event]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
