import { scoreEvidenceText } from "./EvidenceSufficiencyScorer.js";

export type AuditType = "Verified Audit" | "Partial Audit" | "Reasoned Opinion";

export type VerifiedAuditAssessment = {
  auditType: AuditType;
  evidenceChecked: string[];
  claimsVerified: string[];
  claimsNotVerified: string[];
  missingEvidence: string[];
  risks: string[];
  requiredNextProof: string[];
  recommendation: string;
};

export function assessAuditEvidence(text: string): VerifiedAuditAssessment {
  const lines = text.split("\n");
  const sufficiency = scoreEvidenceText(text);
  const hasLocalEvidence = text.includes("## Local Evidence");
  const hasRunEvidence = /\brun-\d{4}-\d{2}-\d{2}T|\bruns\/\d{4}-\d{2}-\d{2}\/run-/i.test(text);
  const hasTraceEvidence = /\btrace\.json\b|\bTrace:\s+runs\//i.test(text);
  const hasEvalEvidence = /Latest Eval Result[\s\S]*Path:\s+evals\/eval_results\/.*\.json/i.test(text) ||
    lines.some((line) => /\bnpm run rax -- eval\b/i.test(line) && /\b(pass(ed)?|0 failed|criticalFailures:\s*0|passRate:\s*1)\b/i.test(line));
  const hasTestEvidence =
    lines.some((line) => /\bnpm run typecheck\b/i.test(line) && /\b(pass(ed)?|exit code 0|0 errors?)\b/i.test(line)) ||
    lines.some((line) => /\bnpm test\b/i.test(line) && /\b(pass(ed)?|exit code 0|\d+\s+tests?\s+passed)\b/i.test(line)) ||
    /\b\d+\s+tests?\s+passed\b/i.test(text);
  const hasFileEvidence = /\b(src|tests|evals|docs|modes)\/[A-Za-z0-9_.\/-]+/i.test(text);
  const hasCommandEvidence = hasTestEvidence || hasEvalEvidence || /\bexit code 0\b/i.test(text);

  const evidenceChecked = [
    ...(hasLocalEvidence ? ["Local evidence block supplied."] : []),
    ...(hasRunEvidence ? ["Run artifact reference supplied."] : []),
    ...(hasTraceEvidence ? ["Trace artifact reference supplied."] : []),
    ...(hasEvalEvidence ? ["Eval result evidence supplied."] : []),
    ...(hasTestEvidence ? ["Typecheck/test command evidence supplied."] : []),
    ...(hasFileEvidence ? ["File path evidence supplied."] : [])
  ];

  const auditType: AuditType = sufficiency.canClaimVerifiedAudit
    ? "Verified Audit"
    : evidenceChecked.length > 0 || !sufficiency.hasOnlyUserProvidedClaims
      ? "Partial Audit"
      : "Reasoned Opinion";

  const claimsVerified = [
    ...(hasTestEvidence ? ["Typecheck/test evidence was supplied for at least one claim."] : []),
    ...(hasEvalEvidence ? ["Eval evidence was supplied for at least one claim."] : []),
    ...(hasTraceEvidence ? ["Trace evidence was supplied for runtime behavior review."] : []),
    ...(hasRunEvidence ? ["Run artifact evidence was supplied for runtime behavior review."] : []),
    ...(sufficiency.hasRelevantClaimSupport ? ["At least one evidence item is tied to the audited claim."] : [])
  ];

  const claimsNotVerified = [
    ...(hasFileEvidence && !hasTestEvidence ? ["File changes were mentioned without paired test/typecheck evidence."] : []),
    ...(!hasFileEvidence ? ["Modified files were not fully identified from supplied evidence."] : []),
    ...(!hasCommandEvidence ? ["Command pass/fail evidence was not supplied."] : []),
    ...(!sufficiency.hasRelevantClaimSupport ? ["Evidence was not tied to a specific audited claim."] : []),
    ...(sufficiency.hasAmbiguity ? ["Run/thread/workspace ambiguity prevents a verified audit."] : []),
    ...(!hasTraceEvidence && /runtime|trace|learningevent|learning event|mode|boundary/i.test(text)
      ? ["Runtime or boundary claims lack a linked trace artifact."]
      : [])
  ];

  const missingEvidence = [
    ...(!hasFileEvidence ? ["Exact modified files or relevant source files."] : []),
    ...(!hasTestEvidence ? ["Typecheck/test command output."] : []),
    ...(!hasEvalEvidence ? ["Eval or regression eval output."] : []),
    ...(!hasTraceEvidence ? ["Trace path or trace summary for runtime behavior."] : []),
    ...(!sufficiency.hasRelevantClaimSupport ? ["Claim-to-evidence linkage."] : []),
    ...sufficiency.missing.filter((item) => !/none identified/i.test(item))
  ];

  const risks = [
    ...(auditType === "Reasoned Opinion" ? ["No local evidence was checked; conclusion may be plausible but unproven."] : []),
    ...(auditType === "Partial Audit" ? ["Some evidence was checked, but missing proof can hide fake-complete work."] : []),
    ...(sufficiency.hasAmbiguity ? ["Ambiguous last-run evidence can attach the audit to the wrong run or thread."] : []),
    ...(sufficiency.hasOnlyUserProvidedClaims ? ["User-provided claims were not independently checked against local artifacts."] : []),
    ...(/policy|safety|tool|memory|promotion|schema|boundary/i.test(text) && !hasEvalEvidence
      ? ["Governance-sensitive claims need regression or redteam evidence."]
      : [])
  ];

  const requiredNextProof = [
    ...(!hasTestEvidence ? ["Run npm run typecheck and npm test, then capture the output."] : []),
    ...(!hasEvalEvidence ? ["Run npm run rax -- eval and relevant regression/redteam evals."] : []),
    ...(!hasTraceEvidence ? ["Provide a trace path or run artifact for runtime claims."] : []),
    ...(!hasFileEvidence ? ["List exact files inspected or modified."] : [])
  ];

  const recommendation =
    auditType === "Verified Audit"
      ? "Evidence-backed review possible; still require human approval for promotions or governance changes."
      : auditType === "Partial Audit"
        ? "Treat as needs_review until missing proof is supplied."
        : "Treat as reasoned opinion only; collect local proof before approval.";

  return {
    auditType,
    evidenceChecked: evidenceChecked.length ? evidenceChecked : ["None."],
    claimsVerified: claimsVerified.length ? claimsVerified : ["None from supplied evidence."],
    claimsNotVerified: claimsNotVerified.length ? claimsNotVerified : ["None identified."],
    missingEvidence: missingEvidence.length ? missingEvidence : ["None identified."],
    risks: risks.length ? risks : ["No additional audit-contract risks identified."],
    requiredNextProof: requiredNextProof.length ? requiredNextProof : ["No additional proof required by the audit contract."],
    recommendation
  };
}

export function renderAuditContractSections(assessment: VerifiedAuditAssessment): string[] {
  return [
    "## Audit Type",
    `- ${assessment.auditType}`,
    "",
    "## Evidence Checked",
    ...bulletize(assessment.evidenceChecked),
    "",
    "## Claims Verified",
    ...bulletize(assessment.claimsVerified),
    "",
    "## Claims Not Verified",
    ...bulletize(assessment.claimsNotVerified),
    "",
    "## Risks",
    ...bulletize(assessment.risks),
    "",
    "## Required Next Proof",
    ...bulletize(assessment.requiredNextProof),
    "",
    "## Recommendation",
    `- ${assessment.recommendation}`
  ];
}

function bulletize(items: string[]): string[] {
  return items.map((item) => item.startsWith("- ") ? item : `- ${item}`);
}
