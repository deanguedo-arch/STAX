import { describe, expect, it } from "vitest";
import { AppendOnlyLedger } from "../../src/staxcore/shared/index.js";

describe("staxcore append-only ledger", () => {
  it("chains event hashes without mutation", () => {
    const ledger = new AppendOnlyLedger<{ claim: string }>();
    const first = ledger.append("event-1", { claim: "first" });
    const second = ledger.append("event-2", { claim: "second" });

    expect(second.previousHash).toBe(first.hash);
    expect(ledger.all()).toHaveLength(2);
    expect(ledger.verifyChain().valid).toBe(true);
  });

  it("detects tampering during verification", () => {
    const ledger = new AppendOnlyLedger<{ claim: string }>();
    ledger.append("event-1", { claim: "first" });
    ledger.append("event-2", { claim: "second" });

    const mutable = ledger.all() as unknown as Array<{ event: { claim: string } }>;
    mutable[1].event.claim = "tampered-second";

    const result = ledger.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("replays immutable chain entries in order", () => {
    const ledger = new AppendOnlyLedger<{ claim: string }>();
    ledger.append("event-1", { claim: "first" });
    ledger.append("event-2", { claim: "second" });

    const replayed = ledger.replay();
    expect(replayed).toHaveLength(2);
    expect(replayed[0].sequence).toBe(1);
    expect(replayed[1].sequence).toBe(2);
  });
});
