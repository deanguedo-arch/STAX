import { describe, expect, it } from "vitest";
import {
  compareProviderCampaigns,
  type CampaignSnapshot
} from "../src/campaign/ProviderCampaignComparison.js";

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignStatus: "real_use_candidate",
    provider: {
      generator: "mock",
      critic: "mock",
      evaluator: "mock"
    },
    taskCount: 10,
    usefulSessions: 8,
    totalCleanupPromptsNeeded: 2,
    fakeCompleteChecks: 2,
    fakeCompleteCaught: 2,
    uniqueOneNextActions: 6,
    uniqueOutputShapes: 6,
    ...overrides
  };
}

describe("compareProviderCampaigns", () => {
  it("returns blocked when provider run is missing", () => {
    const result = compareProviderCampaigns(snapshot(), null);
    expect(result.status).toBe("provider_run_blocked");
  });

  it("marks improved when provider increases specificity", () => {
    const mock = snapshot();
    const provider = snapshot({
      provider: { generator: "openai", critic: "mock", evaluator: "mock" },
      uniqueOneNextActions: 9,
      uniqueOutputShapes: 8
    });

    const result = compareProviderCampaigns(mock, provider);
    expect(result.status).toBe("provider_improved");
    expect(result.deltas.uniqueActionsDelta).toBe(3);
  });

  it("marks parity when provider is neither worse nor better", () => {
    const mock = snapshot();
    const provider = snapshot({
      provider: { generator: "openai", critic: "mock", evaluator: "mock" }
    });

    const result = compareProviderCampaigns(mock, provider);
    expect(result.status).toBe("provider_parity");
    expect(result.deltas.cleanupDelta).toBe(0);
  });

  it("marks regression when provider increases cleanup burden", () => {
    const mock = snapshot();
    const provider = snapshot({
      provider: { generator: "openai", critic: "mock", evaluator: "mock" },
      totalCleanupPromptsNeeded: 5
    });

    const result = compareProviderCampaigns(mock, provider);
    expect(result.status).toBe("provider_regression");
    expect(result.deltas.cleanupDelta).toBe(3);
  });
});
