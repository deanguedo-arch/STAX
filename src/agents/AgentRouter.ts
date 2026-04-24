import type { Mode } from "../schemas/Config.js";
import type { Agent } from "./Agent.js";

export type RouteInput = {
  input: string;
  riskLabels: string[];
};

export type RouteResult = {
  agent: Agent;
  mode: Mode;
  reason: string;
};

export type RouterAgents = {
  intake: Agent;
  analyst: Agent;
  planner: Agent;
};

export class AgentRouter {
  constructor(private agents: RouterAgents) {}

  route(routeInput: RouteInput): RouteResult {
    const text = routeInput.input.toLowerCase();

    if (
      text.includes("stax") ||
      text.includes("fitness") ||
      text.includes("jiu jitsu") ||
      text.includes("lifting") ||
      text.includes("workout") ||
      text.includes("sleep") ||
      text.includes("recovery") ||
      text.includes("diet") ||
      text.includes("signal intake")
    ) {
      return {
        agent: this.agents.intake,
        mode: "stax_fitness",
        reason: "STAX or fitness signal term detected"
      };
    }

    if (
      text.includes("extract") ||
      text.includes("signal") ||
      text.includes("ingest") ||
      text.includes("observed fact")
    ) {
      return {
        agent: this.agents.intake,
        mode: "intake",
        reason: "Signal or extraction request detected"
      };
    }

    if (
      text.includes("build") ||
      text.includes("plan") ||
      text.includes("project") ||
      text.includes("implement")
    ) {
      return {
        agent: this.agents.planner,
        mode: "planning",
        reason: "Planning or implementation request detected"
      };
    }

    if (
      text.includes("audit") ||
      text.includes("review") ||
      text.includes("critic")
    ) {
      return {
        agent: this.agents.analyst,
        mode: "audit",
        reason: "Audit request detected"
      };
    }

    return {
      agent: this.agents.analyst,
      mode: "analysis",
      reason: "Default analysis route"
    };
  }
}
