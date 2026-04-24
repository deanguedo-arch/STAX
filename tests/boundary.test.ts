import { describe, expect, it } from "vitest";
import { BoundaryDecision } from "../src/safety/BoundaryDecision.js";
import type { RiskScore } from "../src/schemas/RiskScore.js";

function score(partial: Partial<RiskScore>): RiskScore {
  return {
    intent: 0,
    harm: 0,
    actionability: 0,
    privacy: 0,
    exploitation: 0,
    regulatedAdvice: 0,
    systemIntegrity: 0,
    total: 0,
    labels: [],
    ...partial
  };
}

describe("BoundaryDecision", () => {
  it("allows low risk", () => {
    const result = new BoundaryDecision().decide(score({ total: 1 }));

    expect(result.mode).toBe("allow");
  });

  it("refuses privacy hard stop", () => {
    const result = new BoundaryDecision().decide(
      score({ privacy: 3, total: 3 })
    );

    expect(result.mode).toBe("refuse");
    expect(result.reason).toContain("Privacy");
  });

  it("constrains moderate risk", () => {
    const result = new BoundaryDecision().decide(score({ total: 5 }));

    expect(result.mode).toBe("constrain");
  });
});
