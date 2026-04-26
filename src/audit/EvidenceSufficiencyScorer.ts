import type { ProofPacket } from "./ProofPacket.js";

export type EvidenceSufficiencyScore = {
  hasConcreteArtifact: boolean;
  hasCommandResult: boolean;
  hasTraceOrRun: boolean;
  hasRelevantClaimSupport: boolean;
  hasOnlyUserProvidedClaims: boolean;
  hasAmbiguity: boolean;
  canClaimVerifiedAudit: boolean;
  reasons: string[];
  missing: string[];
};

export function scoreProofPacket(packet: ProofPacket): EvidenceSufficiencyScore {
  const hasConcreteArtifact = packet.evidenceItems.some((item) => Boolean(item.path || item.command));
  const hasCommandResult = packet.evidenceItems.some(
    (item) =>
      item.evidenceType === "command" ||
      item.evidenceType === "test" ||
      item.evidenceType === "eval" ||
      Boolean(item.command)
  );
  const hasTraceOrRun = packet.evidenceItems.some((item) => item.evidenceType === "trace" || item.evidenceType === "run") ||
    Boolean(packet.runId);
  const hasRelevantClaimSupport = packet.evidenceItems.some((item) => Boolean(item.claimSupported));
  const hasAmbiguity = packet.ambiguityWarnings.length > 0;
  return finalizeScore({
    hasConcreteArtifact,
    hasCommandResult,
    hasTraceOrRun,
    hasRelevantClaimSupport,
    hasOnlyUserProvidedClaims: packet.evidenceItems.length === 0,
    hasAmbiguity
  });
}

export function scoreEvidenceText(text: string): EvidenceSufficiencyScore {
  const lines = text.split("\n");
  const hasPathEvidence = /\b(runs\/\d{4}-\d{2}-\d{2}\/run-[^\s]+|evals\/eval_results\/[^\s]+\.json|learning\/events\/hot\/[^\s]+\.json|src\/[A-Za-z0-9_.\/-]+|tests\/[A-Za-z0-9_.\/-]+)\b/i.test(text);
  const hasCommandLineResult = lines.some(
    (line) =>
      /\b(npm run typecheck|npm test|npm run rax -- eval)\b/i.test(line) &&
      /\b(pass(ed)?|exit code 0|0 failed|criticalFailures:\s*0|passRate:\s*1|\d+\s+tests?\s+passed)\b/i.test(line) &&
      !/\b(not supplied|missing|required next proof|pass\/fail)\b/i.test(line)
  );
  const hasEvalArtifact = /Latest Eval Result[\s\S]*Path:\s+evals\/eval_results\/.*\.json/i.test(text) ||
    /\bevals\/eval_results\/[^\s]+\.json\b/i.test(text);
  const hasTraceOrRun = /\brun-\d{4}-\d{2}-\d{2}T|\bruns\/\d{4}-\d{2}-\d{2}\/run-|trace\.json\b/i.test(text);
  const hasClaimSupport = /\b(ClaimSupported:|claim supported|Trace evidence|Eval evidence|Run artifact evidence|Latest eval artifact|Latest run folder|Trace: runs\/|Path:\s+evals\/)/i.test(text);
  const ambiguitySection = text.match(/## Proof Ambiguity Warnings([\s\S]*?)(?:\n##\s+|$)/i)?.[1] ?? "";
  const hasNonEmptyAmbiguitySection = ambiguitySection
    .split("\n")
    .map((line) => line.trim())
    .some((line) => /^-\s+/.test(line) && !/^-?\s*none\.?$/i.test(line.replace(/^-\s+/, "")));
  const hasAmbiguity = hasNonEmptyAmbiguitySection ||
    /\b(ambiguous|multiple possible latest|wrong last|unresolved run|unresolved thread)\b/i.test(text.replace(/## Proof Ambiguity Warnings[\s\S]*?(?:\n##\s+|$)/i, ""));
  const hasLocalEvidence = text.includes("## Local Evidence") || text.includes("## Proof Packet");

  return finalizeScore({
    hasConcreteArtifact: hasPathEvidence || hasEvalArtifact,
    hasCommandResult: hasCommandLineResult || hasEvalArtifact,
    hasTraceOrRun,
    hasRelevantClaimSupport: hasClaimSupport && (hasPathEvidence || hasEvalArtifact || hasTraceOrRun),
    hasOnlyUserProvidedClaims: !hasLocalEvidence && !hasPathEvidence && !hasEvalArtifact && !hasCommandLineResult,
    hasAmbiguity
  });
}

function finalizeScore(
  flags: Omit<EvidenceSufficiencyScore, "canClaimVerifiedAudit" | "reasons" | "missing">
): EvidenceSufficiencyScore {
  const missing = [
    ...(!flags.hasConcreteArtifact ? ["Specific artifact path or command record."] : []),
    ...(!flags.hasCommandResult ? ["Command/eval result evidence."] : []),
    ...(!flags.hasTraceOrRun ? ["Trace or run evidence for runtime claims."] : []),
    ...(!flags.hasRelevantClaimSupport ? ["Evidence explicitly tied to the claim being audited."] : []),
    ...(flags.hasAmbiguity ? ["Resolve run/thread/workspace ambiguity before verified audit."] : [])
  ];
  const reasons = [
    ...(flags.hasConcreteArtifact ? ["Specific artifact evidence was supplied."] : []),
    ...(flags.hasCommandResult ? ["Command or eval result evidence was supplied."] : []),
    ...(flags.hasTraceOrRun ? ["Trace or run evidence was supplied."] : []),
    ...(flags.hasRelevantClaimSupport ? ["Evidence is tied to at least one audited claim."] : []),
    ...(flags.hasAmbiguity ? ["Evidence source has ambiguity warnings."] : []),
    ...(flags.hasOnlyUserProvidedClaims ? ["Only user-provided claims were supplied."] : [])
  ];
  const canClaimVerifiedAudit =
    flags.hasConcreteArtifact &&
    flags.hasCommandResult &&
    flags.hasTraceOrRun &&
    flags.hasRelevantClaimSupport &&
    !flags.hasAmbiguity &&
    !flags.hasOnlyUserProvidedClaims;

  return {
    ...flags,
    canClaimVerifiedAudit,
    reasons: reasons.length ? reasons : ["No concrete audit evidence detected."],
    missing: missing.length ? missing : ["None identified."]
  };
}
