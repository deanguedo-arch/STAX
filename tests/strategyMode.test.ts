import { describe, expect, it } from "vitest";
import { StrategyMode } from "../src/strategy/StrategyMode.js";

describe("StrategyMode", () => {
  const mode = new StrategyMode();

  it("allows business strategy without claiming verification", () => {
    const result = mode.answer({ question: "What product strategy should STAX try next?" });

    expect(result.proofStatus).toBe("reasoned_strategy_not_verified");
    expect(result.recommendedExperiment).toContain("bounded");
  });

  it("requests evidence for repo-specific strategy", () => {
    const result = mode.answer({ question: "What should this repo do next?", repoSpecific: true });

    expect(result.evidenceToCollect.join(" ")).toContain("package.json");
  });

  it("formats with required proof status", () => {
    const output = mode.format(mode.answer({ question: "Strategy?" }));

    expect(output).toContain("## Proof Status");
    expect(output).toContain("reasoned_strategy_not_verified");
  });
});
