import type { BoundaryMode } from "../safety/BoundaryDecision.js";
import type { ValidationResult } from "../utils/validators.js";
import type { Mode, RaxConfig } from "./Config.js";
import type { RiskScore } from "./RiskScore.js";

export type RaxOutput = {
  runId: string;
  mode: BoundaryMode;
  taskMode: Mode | "boundary";
  agent: string;
  risk: RiskScore;
  output: string;
  critic?: string;
  formatter?: string;
  validation: ValidationResult;
  versions: NonNullable<RaxConfig["versions"]>;
  createdAt: string;
};
