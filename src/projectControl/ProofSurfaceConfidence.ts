import type { ProofSurfaceConfidence, ProofSurfaceRule } from "./ProofSurfacePackSchemas.js";

export function aggregateProofSurfaceConfidence(rules: ProofSurfaceRule[], warningCount: number): ProofSurfaceConfidence {
  if (rules.length === 0) return "low";
  if (warningCount > 2) return "medium";
  if (rules.some((rule) => rule.confidence === "high")) return "high";
  return "medium";
}
