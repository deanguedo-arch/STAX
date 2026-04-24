import type { ModelProvider } from "../providers/ModelProvider.js";
import type { AgentResult } from "../schemas/AgentResult.js";
import type { Mode, RaxConfig } from "../schemas/Config.js";
import type { RiskScore } from "../schemas/RiskScore.js";

export type AgentInput = {
  input: string;
  system: string;
  risk: RiskScore;
  context: string[];
  provider: ModelProvider;
  config: RaxConfig;
  mode: Mode;
};

export interface Agent {
  name: string;
  mode: Mode;
  execute(input: AgentInput): Promise<AgentResult>;
}
