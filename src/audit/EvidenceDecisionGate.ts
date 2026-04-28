import { scoreEvidenceText } from "./EvidenceSufficiencyScorer.js";
import { ProofBoundaryClassifier } from "../evidence/ProofBoundaryClassifier.js";
import { RuntimeEvidenceGate } from "../evidence/RuntimeEvidenceGate.js";

export type EvidenceClass =
  | "local_command"
  | "local_trace"
  | "local_eval"
  | "local_file"
  | "ci"
  | "pasted_human"
  | "inferred"
  | "missing";

export type EvidenceDecisionLabel =
  | "verified"
  | "partial"
  | "reasoned_opinion"
  | "blocked_for_evidence";

export type EvidenceDecision = {
  decision: EvidenceDecisionLabel;
  confidence: "low" | "medium" | "high";
  evidenceClasses: EvidenceClass[];
  scopeBoundary: string;
  assumptions: string[];
  requiredNextProof: string[];
  reasons: string[];
};

export function decideEvidence(text: string): EvidenceDecision {
  const evidenceClasses = classifyEvidence(text);
  const sufficiency = scoreEvidenceText(text);
  const conflict = hasConflictingEvidence(text);
  const runtime = new RuntimeEvidenceGate().evaluate({ claim: text, evidence: text });
  const boundary = new ProofBoundaryClassifier().classify({ claim: text, evidence: text });
  const decision: EvidenceDecisionLabel = conflict
    ? "blocked_for_evidence"
    : runtime.status === "failed"
      ? "blocked_for_evidence"
    : sufficiency.canClaimVerifiedAudit
      ? "verified"
      : evidenceClasses.some((item) => item.startsWith("local_") || item === "ci")
        ? "partial"
        : "reasoned_opinion";
  const confidence = decision === "verified" ? "high" : decision === "partial" ? "medium" : "low";
  return {
    decision,
    confidence,
    evidenceClasses,
    scopeBoundary: `${scopeBoundary(text, decision)} ${proofBoundaryText(boundary)}`,
    assumptions: assumptions(text, evidenceClasses, conflict),
    requiredNextProof: Array.from(new Set([
      ...requiredNextProof(decision, sufficiency.missing, conflict),
      ...boundary.requiredNextProof,
      ...(runtime.requiredNextCommand ? [`Run ${runtime.requiredNextCommand} and capture the output.`] : [])
    ])),
    reasons: [
      ...sufficiency.reasons,
      ...runtime.reasons,
      `Proof boundary family: ${boundary.evidenceFamily}.`,
      ...(conflict ? ["Conflicting pass/fail evidence was detected."] : [])
    ]
  };
}

export function renderEvidenceDecision(decision: EvidenceDecision): string[] {
  return [
    "## Evidence Decision",
    `- Decision: ${decision.decision}`,
    `- Confidence: ${decision.confidence}`,
    `- Evidence Classes: ${decision.evidenceClasses.join(", ")}`,
    `- Scope Boundary: ${decision.scopeBoundary}`,
    "- Assumptions:",
    ...decision.assumptions.map((item) => `  - ${item}`),
    "- Required Next Proof:",
    ...decision.requiredNextProof.map((item) => `  - ${item}`)
  ];
}

function classifyEvidence(text: string): EvidenceClass[] {
  const classes = new Set<EvidenceClass>();
  if (/\b(evidence\/commands\/[^\s]+\.json|cmd-ev-[A-Za-z0-9-]+|npm run typecheck|npm test|npm run rax -- eval|exit code 0|\d+\s+tests?\s+passed)\b/i.test(text) && hasLocalMarker(text)) {
    classes.add("local_command");
  }
  if (/\b(trace\.json|Trace:\s+runs\/|runs\/\d{4}-\d{2}-\d{2}\/run-)/i.test(text)) {
    classes.add("local_trace");
  }
  if (/\b(evals\/eval_results\/[^\s]+\.json)\b/i.test(text) ||
    (hasLocalMarker(text) && /\b(Latest Eval Result|passRate:\s*1|criticalFailures:\s*0)\b/i.test(text))) {
    classes.add("local_eval");
  }
  if (/\b(src|tests|evals|docs|modes|learning)\/[A-Za-z0-9_.\/-]+/i.test(text)) {
    classes.add("local_file");
  }
  if (/\b(GitHub Actions|CI|build log|check run|workflow run|Dependabot)\b/i.test(text)) {
    classes.add("ci");
  }
  if (isPastedClaim(text)) {
    classes.add("pasted_human");
  }
  if (/\b(should be|probably|inferred|assume|likely|reasoned opinion)\b/i.test(text)) {
    classes.add("inferred");
  }
  if (classes.size === 0 || (!hasLocalMarker(text) && classes.has("pasted_human") && classes.size === 1)) {
    classes.add("missing");
  }
  return Array.from(classes);
}

function hasLocalMarker(text: string): boolean {
  return /\b(## Local Evidence|## Proof Packet|ProofPacket:|Trace:\s+runs\/|Path:\s+evals\/|evidence\/commands\/|ClaimSupported:)\b/i.test(text);
}

function isPastedClaim(text: string): boolean {
  return /\b(pasted|user says|user-provided|only evidence is pasted|only supplied evidence|says npm test passed|claims? tests? pass|Codex says)\b/i.test(text) ||
    (!hasLocalMarker(text) && /\b(npm test passed|tests pass|typecheck passes|evals pass)\b/i.test(text));
}

function hasConflictingEvidence(text: string): boolean {
  const lower = text.toLowerCase();
  const passSignal = /\b(pass(ed)?|exit code 0|0 failed|passrate:\s*1|\d+\s+tests?\s+passed)\b/i.test(lower);
  const failSignal = /\b(exit code [1-9]|criticalfailures:\s*[1-9]|failed run|tests? failed|[1-9]\d*\s+failed|failed\s+[1-9]\d*)\b/i.test(lower);
  return passSignal && failSignal;
}

function scopeBoundary(text: string, decision: EvidenceDecisionLabel): string {
  if (decision === "verified") {
    return "Verified only for the supplied local command, trace, eval, and claim-linked artifact scope.";
  }
  if (decision === "blocked_for_evidence") {
    return "No verification scope is allowed until conflicting evidence is resolved.";
  }
  if (/\bworkspace|repo|package|linked repo\b/i.test(text)) {
    return "Limited to the explicitly supplied workspace/repo evidence; do not generalize across packages.";
  }
  return "Limited to the supplied text; no broader repo or runtime conclusion is verified.";
}

function assumptions(text: string, classes: EvidenceClass[], conflict: boolean): string[] {
  if (conflict) return ["Pass/fail conflict may indicate flaky, stale, or mismatched evidence."];
  const result = [
    ...(classes.includes("pasted_human") ? ["Pasted claims may be accurate but are not local command evidence."] : []),
    ...(!hasLocalMarker(text) ? ["No first-class local proof marker was supplied."] : []),
    ...(classes.includes("local_file") && !classes.includes("local_command") ? ["File paths alone do not prove behavior passed."] : [])
  ];
  return result.length ? result : ["Evidence classes are interpreted only from supplied text."];
}

function requiredNextProof(decision: EvidenceDecisionLabel, missing: string[], conflict: boolean): string[] {
  if (conflict) return ["Resolve the conflicting pass/fail evidence with a fresh local command or eval artifact."];
  if (decision === "verified") return ["No additional proof required for the supplied scope; human approval is still required for promotion."];
  return Array.from(new Set([
    ...missing.filter((item) => !/none identified/i.test(item)),
    "Provide local command/eval/trace evidence tied to the claim before using verified language."
  ]));
}

function proofBoundaryText(boundary: ReturnType<ProofBoundaryClassifier["classify"]>): string {
  if (boundary.evidenceFamily === "unknown") return "No specific proof family was detected.";
  return [
    `Proof family ${boundary.evidenceFamily} verifies: ${boundary.verifiedScope.join(", ") || "nothing broad"}.`,
    `Unverified: ${boundary.unverifiedScope.join(", ")}.`
  ].join(" ");
}
