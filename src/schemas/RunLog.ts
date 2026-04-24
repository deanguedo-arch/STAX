import type { BoundaryResult } from "../safety/BoundaryDecision.js";
import type { BoundaryMode } from "../safety/BoundaryDecision.js";
import type { RaxConfig } from "./Config.js";
import type { DetailLevel, RaxMode } from "./Config.js";
import type { RiskScore } from "./RiskScore.js";

export type ModelCallTrace = {
  provider: string;
  model: string;
  tokens?: number;
  latencyMs: number;
};

export type RunTrace = {
  runId: string;
  createdAt: string;
  runtimeVersion: string;
  provider: string;
  model: string;
  criticModel: string;
  temperature: number;
  criticTemperature: number;
  topP: number;
  seed: number;
  mode: RaxMode;
  modeConfidence: number;
  boundaryMode: BoundaryMode;
  selectedAgent: string;
  policiesApplied: string[];
  criticPasses: number;
  repairPasses: number;
  formatterPasses: number;
  schemaRetries: number;
  latencyMs: number;
  toolCalls: Array<{
    id?: string;
    tool: string;
    input?: unknown;
    reason: string;
    allowed: boolean;
    resultSummary?: string;
    error?: string;
  }>;
  errors: string[];
  stack?: string[];
  routingDecision?: Record<string, unknown>;
  agentSequence?: string[];
  riskScore?: RiskScore;
  boundaryDecision?: BoundaryResult;
  modelCalls?: ModelCallTrace[];
  validation?: Record<string, unknown>;
  retries?: number;
  detailLevel?: DetailLevel;
};

export type RunLog = {
  runId: string;
  input: string;
  config: RaxConfig;
  trace: RunTrace;
  finalOutput: string;
  createdAt: string;
};
