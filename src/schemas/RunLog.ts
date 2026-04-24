import type { BoundaryResult } from "../safety/BoundaryDecision.js";
import type { RaxConfig } from "./Config.js";
import type { RiskScore } from "./RiskScore.js";

export type ModelCallTrace = {
  provider: string;
  model: string;
  tokens?: number;
  latencyMs: number;
};

export type RunTrace = {
  stack: string[];
  routingDecision?: Record<string, unknown>;
  agentSequence: string[];
  riskScore: RiskScore;
  boundaryDecision: BoundaryResult;
  modelCalls: ModelCallTrace[];
  validation: Record<string, unknown>;
  retries: number;
};

export type RunLog = {
  runId: string;
  input: string;
  config: RaxConfig;
  trace: RunTrace;
  finalOutput: string;
  createdAt: string;
};
