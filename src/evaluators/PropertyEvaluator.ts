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
