import {
  VisualEvidenceInputSchema,
  VisualEvidenceResultSchema,
  type VisualEvidenceInput,
  type VisualEvidenceResult
} from "./VisualEvidenceSchemas.js";

export class VisualEvidenceProtocol {
  evaluate(input: VisualEvidenceInput): VisualEvidenceResult {
    const parsed = VisualEvidenceInputSchema.parse(input);
    const reasons: string[] = [];
    const requiredNextEvidence: string[] = [];

    if (parsed.sourceEvidenceOnly || parsed.artifactType === "missing") {
      reasons.push("Source files alone cannot prove rendered visual correctness.");
      requiredNextEvidence.push(`Capture a screenshot or manual visual finding for ${parsed.target}.`);
      return VisualEvidenceResultSchema.parse({
        target: parsed.target,
        artifactType: parsed.artifactType,
        status: "missing",
        verifiedClaims: [],
        unverifiedClaims: parsed.requiredChecks,
        requiredNextEvidence,
        reasons
      });
    }

    if (!hasArtifact(parsed)) {
      reasons.push("Visual artifact metadata is incomplete.");
      requiredNextEvidence.push("Provide artifact path or hash, route, viewport, and target checklist.");
      return VisualEvidenceResultSchema.parse({
        target: parsed.target,
        artifactType: parsed.artifactType,
        status: "partial",
        verifiedClaims: [],
        unverifiedClaims: parsed.requiredChecks,
        requiredNextEvidence,
        reasons
      });
    }

    if (!parsed.requiredChecks.length) {
      reasons.push("A screenshot without target checks is only partial visual evidence.");
      requiredNextEvidence.push("List the visual checks this artifact is meant to verify.");
      return VisualEvidenceResultSchema.parse({
        target: parsed.target,
        artifactType: parsed.artifactType,
        status: "partial",
        verifiedClaims: [],
        unverifiedClaims: [],
        requiredNextEvidence,
        reasons
      });
    }

    const observed = new Set(parsed.observedChecks.map(normalize));
    const verifiedClaims = parsed.requiredChecks.filter((item) => observed.has(normalize(item)));
    const unverifiedClaims = parsed.requiredChecks.filter((item) => !observed.has(normalize(item)));
    const status = verifiedClaims.length && !unverifiedClaims.length ? "verified" : verifiedClaims.length ? "partial" : "partial";
    if (unverifiedClaims.length) requiredNextEvidence.push(`Add visual findings for: ${unverifiedClaims.join(", ")}.`);
    reasons.push("Visual proof applies only to listed checks; it cannot prove command/test success.");

    return VisualEvidenceResultSchema.parse({
      target: parsed.target,
      artifactType: parsed.artifactType,
      status,
      verifiedClaims,
      unverifiedClaims,
      requiredNextEvidence,
      reasons
    });
  }
}

function hasArtifact(input: ReturnType<typeof VisualEvidenceInputSchema.parse>): boolean {
  return Boolean((input.artifactPath || input.artifactHash) && input.route && input.viewport);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
