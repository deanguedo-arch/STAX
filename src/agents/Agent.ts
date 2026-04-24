import type { ModelProvider } from "../providers/ModelProvider.js";
import type { ExampleItem, MemoryItem, PolicyBundle } from "../policy/policyTypes.js";
import type { AgentResult } from "../schemas/AgentResult.js";
import type { DetailLevel, Mode, RaxConfig } from "../schemas/Config.js";
import type { RiskScore } from "../schemas/RiskScore.js";
import type { BoundaryResult } from "../safety/BoundaryDecision.js";

export type AgentInput = {
  input: string;
  system: string;
  risk: RiskScore;
  context: string[];
  provider: ModelProvider;
  config: RaxConfig;
  mode: Mode;
  policyBundle?: PolicyBundle;
  boundary?: BoundaryResult;
  memory?: MemoryItem[];
  examples?: ExampleItem[];
  detailLevel?: DetailLevel;
};

export interface Agent {
  name: string;
  mode: Mode;
  execute(input: AgentInput): Promise<AgentResult>;
}
