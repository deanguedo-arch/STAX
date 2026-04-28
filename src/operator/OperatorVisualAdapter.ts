import { VisualEvidenceProtocol } from "../evidence/VisualEvidenceProtocol.js";
import type { OperationPlan } from "./OperationSchemas.js";

export function visualEvidenceFor(plan: OperationPlan) {
  return new VisualEvidenceProtocol().evaluate({
    target: visualTarget(plan),
    artifactType: "missing",
    requiredChecks: visualChecks(plan.originalInput),
    sourceEvidenceOnly: true
  });
}

export function visualNextStep(plan: OperationPlan): string {
  const visual = visualEvidenceFor(plan);
  const checks = visual.unverifiedClaims.length ? visual.unverifiedClaims.join(" and ") : "the listed visual checks";
  if (/sports\s*wellness|sportswellness/i.test(plan.originalInput)) {
    return `Capture the rendered Sports Wellness preview evidence for ${checks}; paste back a screenshot or visual finding.`;
  }
  return `${visual.requiredNextEvidence[0] ?? "Capture a rendered screenshot or manual visual finding."} Paste back the artifact plus the target checklist.`;
}

function visualTarget(plan: OperationPlan): string {
  if (/sports\s*wellness|sportswellness/i.test(plan.originalInput)) return "Sports Wellness rendered preview";
  return `${plan.workspace || "workspace"} rendered UI surface`;
}

function visualChecks(input: string): string[] {
  const checks: string[] = [];
  if (/\btext fit|fit|box|overflow\b/i.test(input)) checks.push("text fit");
  if (/\bsymmetrical borders?|border symmetry|border\b/i.test(input)) checks.push("border symmetry");
  if (/\bsmart goals?|checkmark|check mark|containment\b/i.test(input)) checks.push("SMART goals checkmark containment");
  return checks.length ? checks : ["target visual claim"];
}
