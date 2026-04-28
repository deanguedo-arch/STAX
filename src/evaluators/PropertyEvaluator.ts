export type PropertyEvalInput = {
  output: string;
  requiredSections: string[];
  forbiddenPatterns: string[];
  expectedProperties: string[];
  minSignalUnits?: number;
  critical?: boolean;
  expectedBoundaryMode?: string;
  actualBoundaryMode?: string;
  providerCallCount?: number;
};

export type PropertyEvalResult = {
  pass: boolean;
  failReasons: string[];
  criticalFailure: boolean;
};

export function evaluateProperties(input: PropertyEvalInput): PropertyEvalResult {
  const failReasons: string[] = [];
  const claimText = input.output
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith("- raw input:"))
    .join("\n");
  const lower = claimText.toLowerCase();

  for (const section of input.requiredSections) {
    if (!input.output.includes(section)) {
      failReasons.push(`missing required section: ${section}`);
    }
  }

  for (const pattern of input.forbiddenPatterns) {
    if (lower.includes(pattern.toLowerCase())) {
      failReasons.push(`forbidden pattern present: ${pattern}`);
    }
  }

  for (const property of input.expectedProperties) {
    if (property === "mentions_unknowns" && !lower.includes("unknown")) {
      failReasons.push("expected property missing: mentions_unknowns");
    }
    if (property === "no_assumptions" && /obviously|definitely|this proves/i.test(input.output)) {
      failReasons.push("expected property failed: no_assumptions");
    }
    if (property === "no_coaching" && /\b(should|must|recommend|try to)\b/i.test(claimText)) {
      failReasons.push("expected property failed: no_coaching");
    }
    if (
      property === "no_personality_claims" &&
      /disciplined person|lazy|motivated|unmotivated|not committed/i.test(claimText)
    ) {
      failReasons.push("expected property failed: no_personality_claims");
    }
    if (property === "zero_provider_calls" && input.providerCallCount !== 0) {
      failReasons.push("expected property failed: zero_provider_calls");
    }
    if (property === "critic_failure" && !input.output.includes("## Critic Failure")) {
      failReasons.push("expected property failed: critic_failure");
    }
    if (property === "evidence_backed_proven_working") {
      const proven = section(input.output, "## Proven Working");
      const unsupported = proven
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("-"))
        .filter((line) => !/^-\s+(none|no evidence-backed|not supplied)/i.test(line))
        .filter((line) => !/\bev_\d{3,}\b/i.test(line));
      if (unsupported.length > 0 || !proven.trim()) {
        failReasons.push("expected property failed: evidence_backed_proven_working");
      }
    }
    if (property === "fake_complete_flag" && !/fake-complete|claimed tests pass without output|missing evidence/i.test(input.output)) {
      failReasons.push("expected property failed: fake_complete_flag");
    }
    if (property === "bounded_prompt" && /\bfix everything\b/i.test(input.output)) {
      failReasons.push("expected property failed: bounded_prompt");
    }
    if (property === "policy_drift_flag" && !/violation|reject|unsafe|disabled|enabled/i.test(input.output)) {
      failReasons.push("expected property failed: policy_drift_flag");
    }
    if (property === "approval_required" && !/approval required|explicit approval|pending review/i.test(input.output)) {
      failReasons.push("expected property failed: approval_required");
    }
    if (property === "candidate_queues" && !/candidate queues|eval_candidate|codex_prompt_candidate|mode_contract_patch_candidate/i.test(input.output)) {
      failReasons.push("expected property failed: candidate_queues");
    }
    if (property === "evidence_decision_not_verified") {
      const evidenceDecision = section(input.output, "## Evidence Decision");
      if (/\bDecision:\s+verified\b/i.test(evidenceDecision)) {
        failReasons.push("expected property failed: evidence_decision_not_verified");
      }
      if (!/\bDecision:\s+(partial|reasoned_opinion|blocked_for_evidence)\b/i.test(evidenceDecision)) {
        failReasons.push("expected property missing: evidence_decision_not_verified");
      }
    }
    if (property === "evidence_decision_verified") {
      const evidenceDecision = section(input.output, "## Evidence Decision");
      if (!/\bDecision:\s+verified\b/i.test(evidenceDecision)) {
        failReasons.push("expected property failed: evidence_decision_verified");
      }
    }
    if (property === "pasted_human_not_local_command") {
      const evidenceDecision = section(input.output, "## Evidence Decision");
      if (!/\bpasted_human\b/i.test(evidenceDecision)) {
        failReasons.push("expected property failed: pasted_human_not_local_command");
      }
      if (/\blocal_command\b/i.test(evidenceDecision)) {
        failReasons.push("expected property failed: pasted_human_not_local_command");
      }
    }
    if (property === "proof_boundary_distinctions") {
      const requiredBoundaryPairs = [
        { left: /\bdocx\b/i, right: /\bpdf\b/i, label: "DOCX/PDF" },
        { left: /\bocr\b/i, right: /\bstructured recovery\b/i, label: "OCR/structured recovery" },
        { left: /\bcourse[- ]shell\b/i, right: /\brendered preview\b/i, label: "course-shell/rendered preview" },
        { left: /\bcf:convert\b/i, right: /\bcf:validate\b/i, label: "cf:convert/cf:validate" },
        { left: /\bno test script\b/i, right: /\bnpm test\b/i, label: "no test script/npm test" }
      ];
      const missingPairs = requiredBoundaryPairs.filter(({ left, right }) => {
        const leftMatch = left.exec(input.output);
        const rightMatch = right.exec(input.output);
        const leftIndex = leftMatch?.index ?? -1;
        const rightIndex = rightMatch?.index ?? -1;
        if (leftIndex === -1 || rightIndex === -1) return true;
        const start = Math.max(0, Math.min(leftIndex, rightIndex) - 120);
        const end = Math.min(lower.length, Math.max(leftIndex, rightIndex) + 180);
        return !/\b(not|cannot|does not|unverified|separate|distinct|boundary)\b/i.test(lower.slice(start, end));
      });
      if (missingPairs.length > 0) {
        failReasons.push(`expected property failed: proof_boundary_distinctions missing ${missingPairs.map((pair) => pair.label).join(", ")}`);
      }
    }
  }

  if (input.minSignalUnits !== undefined) {
    const signalUnits = input.output.match(/^### SU-\d{3}/gm)?.length ?? 0;
    if (signalUnits < input.minSignalUnits) {
      failReasons.push(
        `minimum signal units not met: expected ${input.minSignalUnits}, got ${signalUnits}`
      );
    }
  }

  if (
    input.expectedBoundaryMode &&
    input.actualBoundaryMode &&
    input.expectedBoundaryMode !== input.actualBoundaryMode
  ) {
    failReasons.push(
      `expected boundary mode ${input.expectedBoundaryMode}, got ${input.actualBoundaryMode}`
    );
  }

  return {
    pass: failReasons.length === 0,
    failReasons,
    criticalFailure: Boolean(input.critical && failReasons.length > 0)
  };
}

function section(output: string, heading: string): string {
  const start = output.indexOf(heading);
  if (start === -1) return "";
  const after = output.slice(start + heading.length);
  const next = after.search(/\n##\s+/);
  return next === -1 ? after : after.slice(0, next);
}
