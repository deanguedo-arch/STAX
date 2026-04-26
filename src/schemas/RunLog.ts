import type { BoundaryResult } from "../safety/BoundaryDecision.js";
import type { BoundaryMode } from "../safety/BoundaryDecision.js";
import type { RaxConfig } from "./Config.js";
import type { DetailLevel, ProviderRole, RaxMode } from "./Config.js";
import type { LearningQueueType } from "../learning/LearningEvent.js";
import type { RiskScore } from "./RiskScore.js";

export type ModelCallTrace = {
  role: ProviderRole;
  provider: string;
  model: string;
  tokens?: number;
  latencyMs: number;
};

export type RunTrace = {
  runId: string;
  createdAt: string;
  workspace?: string;
  linkedRepoPath?: string;
  runtimeVersion: string;
  provider: string;
  model: string;
  providerRoles: Record<string, string>;
  criticModel: string;
  evaluatorModel: string;
  classifierModel: string;
  temperature: number;
  criticTemperature: number;
  evalTemperature: number;
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
  route: Record<string, unknown>;
  replayable: boolean;
  stack?: string[];
  routingDecision?: Record<string, unknown>;
  agentSequence?: string[];
  riskScore?: RiskScore;
  boundaryDecision?: BoundaryResult;
  modelCalls: ModelCallTrace[];
  validation: Record<string, unknown>;
  retries?: number;
  detailLevel?: DetailLevel;
  learningEventId?: string;
  learningQueues?: LearningQueueType[];
};

export type RunLog = {
  runId: string;
  input: string;
  config: RaxConfig;
  trace: RunTrace;
  finalOutput: string;
  createdAt: string;
};
