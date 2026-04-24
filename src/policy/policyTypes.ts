import type { RaxMode } from "../schemas/Config.js";
import type { RiskScore } from "../schemas/RiskScore.js";
import type { BoundaryMode } from "../safety/BoundaryDecision.js";

export type MemoryItem = {
  id: string;
  content: string;
  type?: string;
  approved?: boolean;
};

export type ExampleItem = {
  id: string;
  mode: RaxMode;
  input: string;
  idealOutput: string;
  tags: string[];
  policiesApplied: string[];
  createdAt: string;
};

export type PolicyCompileInput = {
  mode: RaxMode;
  risk: RiskScore;
  boundaryMode: BoundaryMode;
  userInput: string;
  retrievedMemory: MemoryItem[];
  retrievedExamples: ExampleItem[];
};

export type PolicyBundle = {
  policiesApplied: string[];
  compiledSystemPrompt: string;
  outputContract: string;
  forbiddenBehaviors: string[];
  requiredBehaviors: string[];
};
