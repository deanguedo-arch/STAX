import type { Mode } from "../schemas/Config.js";
import type { Agent } from "./Agent.js";
import { ModeDetector } from "../classifiers/ModeDetector.js";

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
  private detector = new ModeDetector();

  constructor(private agents: RouterAgents) {}

  agentForMode(mode: Mode): Agent {
    if (mode === "planning" || mode === "prompt_factory") return this.agents.planner;
    if (mode === "intake" || mode === "stax_fitness") return this.agents.intake;
    return this.agents.analyst;
  }

  route(routeInput: RouteInput): RouteResult {
    const detected = this.detector.detect(routeInput.input);

    if (detected.mode === "stax_fitness") {
      return {
        agent: this.agents.intake,
        mode: "stax_fitness",
        reason: "Explicit fitness signal term detected"
      };
    }

    if (detected.mode === "intake") {
      return {
        agent: this.agents.intake,
        mode: "intake",
        reason: "Signal or extraction request detected"
      };
    }

    if (detected.mode === "planning") {
      return {
        agent: this.agents.planner,
        mode: "planning",
        reason: "Planning or implementation request detected"
      };
    }

    if (detected.mode === "prompt_factory") {
      return {
        agent: this.agents.planner,
        mode: "prompt_factory",
        reason: "Codex prompt factory request detected"
      };
    }

    if (
      detected.mode === "project_brain" ||
      detected.mode === "codex_audit" ||
      detected.mode === "test_gap_audit" ||
      detected.mode === "policy_drift" ||
      detected.mode === "learning_unit" ||
      detected.mode === "model_comparison"
    ) {
      return {
        agent: this.agents.analyst,
        mode: detected.mode,
        reason: `${detected.mode} governance mode detected`
      };
    }

    if (detected.mode === "audit" || detected.mode === "code_review") {
      return {
        agent: this.agents.analyst,
        mode: detected.mode === "code_review" ? "code_review" : "audit",
        reason: "Audit request detected"
      };
    }

    return {
      agent: this.agents.analyst,
      mode:
        detected.mode === "teaching" || detected.mode === "general_chat"
          ? detected.mode
          : "analysis",
      reason: "Default analysis route"
    };
  }
}
