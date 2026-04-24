import type { Mode } from "./Config.js";
import type { Claim } from "./Claim.js";

export type Confidence = "low" | "medium" | "high";

export type AgentResult = {
  agent: string;
  output: string;
  confidence: Confidence;
  schema: Mode | "critic" | "formatter";
  claims?: Claim[];
  errors?: string[];
  notes?: string[];
  metadata?: Record<string, unknown>;
};
