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
