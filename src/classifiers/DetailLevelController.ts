import type { DetailLevel, RaxMode } from "../schemas/Config.js";
import type { BoundaryMode } from "../safety/BoundaryDecision.js";

export class DetailLevelController {
  select(mode: RaxMode, boundaryMode: BoundaryMode): DetailLevel {
    if (boundaryMode === "refuse") return "minimal";
    if (boundaryMode === "constrain" || boundaryMode === "redirect") return "brief";
    if (
      mode === "planning" ||
      mode === "code_review" ||
      mode === "project_brain" ||
      mode === "codex_audit" ||
      mode === "prompt_factory" ||
      mode === "test_gap_audit" ||
      mode === "policy_drift"
    ) return "surgical";
    if (mode === "teaching") return "deep";
    return "standard";
  }
}
