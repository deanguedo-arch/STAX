import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KernelDurableLedger } from "../../../src/staxcore/index.js";

const tempDirs: string[] = [];

async function ledgerPath(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stax-kernel-ledger-"));
  tempDirs.push(root);
  return path.join(root, "kernel", "ledger.json");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("staxcore kernel durable ledger adapter", () => {
  it("persists records across load and save boundaries", async () => {
    const filePath = await ledgerPath();
    const ledger = await KernelDurableLedger.load<Record<string, unknown>>(filePath);

    const first = ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );
    const second = ledger.append(
      { type: "validated_event", eventId: "event-2" },
      {
        expectedTipHash: first.hash,
        id: "record-2",
        recordedAt: "2026-05-10T00:01:00.000Z"
      }
    );

    await ledger.save();
    const reloaded =
      await KernelDurableLedger.load<Record<string, unknown>>(filePath);

    expect(reloaded.all()).toHaveLength(2);
    expect(reloaded.all()[0].event).toEqual({
      type: "validated_event",
      eventId: "event-1"
    });
    expect(reloaded.tipHash()).toBe(second.hash);
    expect(reloaded.verifyChain().valid).toBe(true);
  });

  it("rejects persisted records whose stored hash does not match content", async () => {
    const filePath = await ledgerPath();
    const ledger = await KernelDurableLedger.load<Record<string, unknown>>(filePath);
    ledger.append(
      { type: "validated_event", eventId: "event-1" },
      {
        expectedTipHash: null,
        id: "record-1",
        recordedAt: "2026-05-10T00:00:00.000Z"
      }
    );
    await ledger.save();

    const snapshot = JSON.parse(await fs.readFile(filePath, "utf8")) as {
      records: Array<{ event: Record<string, unknown> }>;
    };
    snapshot.records[0].event.eventId = "tampered";
    await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

    await expect(
      KernelDurableLedger.load<Record<string, unknown>>(filePath)
    ).rejects.toThrow(/stored hash mismatch/);
  });
});
