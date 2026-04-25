import type { RaxMode } from "../schemas/Config.js";
import type { RiskScore } from "../schemas/RiskScore.js";
import type { BoundaryMode } from "../safety/BoundaryDecision.js";

export type PolicySelectionInput = {
  mode: RaxMode;
  risk: RiskScore;
  boundaryMode: BoundaryMode;
  userInput?: string;
  retrievedMemory?: unknown[];
  correctionContext?: boolean;
};

export class PolicySelector {
  select(input: PolicySelectionInput): string[] {
    if (input.boundaryMode === "refuse" || input.boundaryMode === "redirect") {
      const policies = ["core_policy", "safety_policy", "refusal_policy"];
      if (input.risk.privacy >= 3) policies.push("privacy_policy");
      return policies;
    }

    if (input.correctionContext || input.userInput?.toLowerCase().includes("correction")) {
      return ["core_policy", "correction_policy", "evidence_policy", "uncertainty_policy"];
    }

    const common = ["core_policy", "evidence_policy", "uncertainty_policy", "mode_policy"];
    const text = input.userInput?.toLowerCase() ?? "";
    const toolNeeded = /\b(file|folder|repo|repository|code|shell|write|read|git|project|implement|scaffold)\b/.test(text);
    if (input.mode === "planning" || input.mode === "prompt_factory") {
      return toolNeeded ? [...common, "tool_policy"] : common;
    }
    if (
      input.mode === "project_brain" ||
      input.mode === "codex_audit" ||
      input.mode === "test_gap_audit" ||
      input.mode === "policy_drift"
    ) {
      return [...common, "tool_policy", "memory_policy"];
    }
    if (input.mode === "stax_fitness") return [...common, "privacy_policy"];
    if (input.mode === "code_review") return [...common, "tool_policy"];
    if (input.mode === "intake") {
      return input.retrievedMemory?.length ? [...common, "memory_policy"] : common;
    }
    return common;
  }
}
