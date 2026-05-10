import { describe, expect, it } from "vitest";
import {
  hashLedgerRecord,
  stableHash
} from "../../../src/staxcore/index.js";

describe("staxcore canonical hashing", () => {
  it("hashes the same logical object the same regardless of key order", () => {
    const first = stableHash({
      beta: { y: 2, x: 1 },
      alpha: ["a", { d: 4, c: 3 }]
    });
    const second = stableHash({
      alpha: ["a", { c: 3, d: 4 }],
      beta: { x: 1, y: 2 }
    });

    expect(second).toBe(first);
  });

  it("distinguishes null from undefined deterministically", () => {
    expect(stableHash({ value: undefined })).toBe(
      stableHash({ value: undefined })
    );
    expect(stableHash({ value: undefined })).not.toBe(
      stableHash({ value: null })
    );
  });

  it("serializes dates deterministically", () => {
    const date = new Date("2026-05-10T12:00:00.000Z");

    expect(stableHash({ date })).toBe(
      stableHash({ date: new Date("2026-05-10T12:00:00.000Z") })
    );
    expect(stableHash({ date })).not.toBe(
      stableHash({ date: new Date("2026-05-10T12:00:01.000Z") })
    );
  });

  it("changes ledger hashes when record authority fields change", () => {
    const base = {
      id: "record-1",
      doctrineVersion: "core-v1",
      previousHash: "parent-1",
      sequence: 1,
      recordedAt: "2026-05-10T12:00:00.000Z",
      event: { type: "validated_event", claim: "Measured event." }
    };

    expect(hashLedgerRecord(base)).not.toBe(
      hashLedgerRecord({ ...base, event: { ...base.event, claim: "Changed." } })
    );
    expect(hashLedgerRecord(base)).not.toBe(
      hashLedgerRecord({ ...base, doctrineVersion: "core-v2" })
    );
    expect(hashLedgerRecord(base)).not.toBe(
      hashLedgerRecord({ ...base, previousHash: "parent-2" })
    );
    expect(hashLedgerRecord(base)).not.toBe(
      hashLedgerRecord({ ...base, sequence: 2 })
    );
  });
});
