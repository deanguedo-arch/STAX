import type { RaxMode } from "../schemas/Config.js";
import type { RiskScore } from "../schemas/RiskScore.js";
import type { BoundaryMode } from "../safety/BoundaryDecision.js";

export type PolicySelectionInput = {
  mode: RaxMode;
  risk: RiskScore;
  boundaryMode: BoundaryMode;
};

export class PolicySelector {
  select(input: PolicySelectionInput): string[] {
    if (input.boundaryMode === "refuse" || input.boundaryMode === "redirect") {
      const policies = ["core_policy", "safety_policy", "refusal_policy"];
      if (input.risk.privacy >= 3) policies.push("privacy_policy");
      return policies;
    }

    const common = ["core_policy", "evidence_policy", "uncertainty_policy", "mode_policy"];
    if (input.mode === "planning") return [...common, "tool_policy"];
    if (input.mode === "stax_fitness") return [...common, "privacy_policy"];
    if (input.mode === "code_review") return [...common, "tool_policy"];
    if (input.mode === "intake") return [...common, "memory_policy"];
    return common;
  }
}
