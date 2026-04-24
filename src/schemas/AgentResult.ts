import type { Mode } from "./Config.js";

export type Confidence = "low" | "medium" | "high";

export type AgentResult = {
  agent: string;
  output: string;
  confidence: Confidence;
  schema: Mode | "critic" | "formatter";
  notes?: string[];
  metadata?: Record<string, unknown>;
};
