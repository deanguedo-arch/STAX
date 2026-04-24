import { describe, expect, it } from "vitest";
import { AgentRouter } from "../src/agents/AgentRouter.js";
import type { Agent, AgentInput } from "../src/agents/Agent.js";

function fakeAgent(name: string): Agent {
  return {
    name,
    mode: "analysis",
    async execute(_input: AgentInput) {
      return {
        agent: name,
        output: name,
        confidence: "high",
        schema: "analysis"
      };
    }
  };
}

describe("AgentRouter", () => {
  const router = new AgentRouter({
    intake: fakeAgent("intake"),
    analyst: fakeAgent("analyst"),
    planner: fakeAgent("planner")
  });

  it("routes signal requests to intake", () => {
    const route = router.route({
      input: "extract this signal",
      riskLabels: []
    });

    expect(route.agent.name).toBe("intake");
    expect(route.mode).toBe("intake");
  });

  it("routes build requests to planner", () => {
    const route = router.route({
      input: "build this project",
      riskLabels: []
    });

    expect(route.agent.name).toBe("planner");
    expect(route.mode).toBe("planning");
  });

  it("routes STAX fitness requests to intake with the STAX mode", () => {
    const route = router.route({
      input: "STAX signal intake: jiu jitsu and sleep",
      riskLabels: []
    });

    expect(route.agent.name).toBe("intake");
    expect(route.mode).toBe("stax_fitness");
  });
});
