import { describe, expect, it } from "vitest";
import { summarizeRealUseCampaign, type RealUseCampaignLedger } from "../src/campaign/RealUseCampaignIntegrity.js";

function task(id: number, overrides: Partial<RealUseCampaignLedger["tasks"][number]> = {}) {
  return {
    taskId: `real_codex_${String(id).padStart(3, "0")}`,
    repo: id % 2 === 0 ? "STAX" : "ADMISSION-APP",
    staxInitialPromptUseful: true,
    staxReportAudited: true,
    fakeCompleteCaught: id <= 3,
    missingProofCaught: true,
    wrongRepoPrevented: false,
    cleanupPromptsAfterCodex: 0,
    finalOutcome: "verified_next_state",
    staxCriticalMiss: false,
    humanDecision: "accepted",
    evalCandidate: id === 1,
    ...overrides
  };
}

describe("summarizeRealUseCampaign", () => {
  it("marks a clean 10-task ledger useful", () => {
    const ledger = {
      campaignId: "clean",
      tasks: Array.from({ length: 10 }, (_, index) => task(index + 1))
    };
    const summary = summarizeRealUseCampaign(ledger);
    expect(summary.status).toBe("real_use_useful");
    expect(summary.staxCriticalMisses).toBe(0);
    expect(summary.meaningfulCatches).toBeGreaterThanOrEqual(3);
  });

  it("blocks promotion when useful initial prompts are below target", () => {
    const ledger = {
      campaignId: "blocked",
      tasks: Array.from({ length: 10 }, (_, index) => task(index + 1, { staxInitialPromptUseful: index < 3 }))
    };
    const summary = summarizeRealUseCampaign(ledger);
    expect(summary.status).toBe("promotion_blocked");
    expect(summary.blockers).toContain("fewer than 8 useful initial STAX prompts recorded");
  });

  it("fails invalid when any STAX critical miss is recorded", () => {
    const ledger = {
      campaignId: "critical",
      tasks: Array.from({ length: 10 }, (_, index) => task(index + 1, { staxCriticalMiss: index === 0 }))
    };
    const summary = summarizeRealUseCampaign(ledger);
    expect(summary.status).toBe("invalid");
    expect(summary.blockers).toContain("STAX critical miss recorded");
  });
});
