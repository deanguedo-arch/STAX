import type { Agent } from "./Agent.js";
import { AnalystAgent } from "./AnalystAgent.js";
import { CriticAgent } from "./CriticAgent.js";
import { FormatterAgent } from "./FormatterAgent.js";
import { IntakeAgent } from "./IntakeAgent.js";
import { PlannerAgent } from "./PlannerAgent.js";

export type AgentSet = {
  intake: Agent;
  analyst: Agent;
  planner: Agent;
  critic: Agent;
  formatter: Agent;
};

export function createAgentSet(): AgentSet {
  return {
    intake: new IntakeAgent(),
    analyst: new AnalystAgent(),
    planner: new PlannerAgent(),
    critic: new CriticAgent(),
    formatter: new FormatterAgent()
  };
}
