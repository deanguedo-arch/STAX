import { describe, expect, it } from "vitest";
import { compareSubscriptionCampaign } from "../src/campaign/SubscriptionCampaignComparison.js";

describe("compareSubscriptionCampaign", () => {
  it("returns awaiting_scores when no entries are provided", () => {
    const result = compareSubscriptionCampaign([], ["a", "b"]);
    expect(result.status).toBe("awaiting_scores");
    expect(result.summary.total).toBe(0);
  });

  it("applies critical miss override before score margin", () => {
    const result = compareSubscriptionCampaign(
      [
        {
          taskId: "task-1",
          staxScore: 10,
          chatgptScore: 2,
          staxCriticalMiss: true,
          chatgptCriticalMiss: false
        }
      ],
      ["task-1"]
    );
    expect(result.summary.chatgptWins).toBe(1);
    expect(result.cases[0]?.winner).toBe("chatgpt");
    expect(result.status).toBe("scored_with_losses");
  });

  it("returns scored_no_losses when all expected scores are present and stax has no losses", () => {
    const result = compareSubscriptionCampaign(
      [
        {
          taskId: "task-1",
          staxScore: 9,
          chatgptScore: 7,
          staxCriticalMiss: false,
          chatgptCriticalMiss: false
        },
        {
          taskId: "task-2",
          staxScore: 8,
          chatgptScore: 8,
          staxCriticalMiss: false,
          chatgptCriticalMiss: false
        }
      ],
      ["task-1", "task-2"]
    );
    expect(result.summary.staxWins).toBe(1);
    expect(result.summary.chatgptWins).toBe(0);
    expect(result.status).toBe("scored_no_losses");
  });
});
