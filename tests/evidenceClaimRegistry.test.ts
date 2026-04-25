import { describe, expect, it } from "vitest";
import { ClaimLedger } from "../src/claims/ClaimLedger.js";
import { EvidenceRegistry } from "../src/evidence/EvidenceRegistry.js";

describe("evidence registry and claim ledger", () => {
  it("loads evidence IDs used by Project Brain", async () => {
    const registry = new EvidenceRegistry(process.cwd());
    const ev001 = await registry.find("ev_001");
    const ev006 = await registry.find("ev_006");

    expect(ev001?.confidence).toBe("high");
    expect(ev001?.path).toBe("docs/RAX_100_PROOF_REPORT.md");
    expect(ev006?.claim).toContain("Approved Learning Runtime");
    expect(ev006?.command).toBe("npm test");
  });

  it("loads unproven claims and can propose a new claim ledger item", async () => {
    const ledger = new ClaimLedger(process.cwd());
    const claims = await ledger.list();
    const unproven = await ledger.unproven();
    const proposed = ledger.proposeClaim({
      claim: "Codex Audit is behavior-proven.",
      source: "codex_audit"
    });

    expect(claims.find((item) => item.id === "claim_stax_v0_2_approved_learning_runtime")?.state).toBe("proven");
    expect(unproven.map((item) => item.id)).toContain("claim_project_brain_behavior_proven");
    expect(proposed.state).toBe("claimed");
    expect(proposed.id).toContain("claim_codex-audit-is-behavior-proven");
  });
});
