export type PropertyEvalInput = {
  output: string;
  requiredSections: string[];
  forbiddenPatterns: string[];
  expectedProperties: string[];
};

export type PropertyEvalResult = {
  pass: boolean;
  failReasons: string[];
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
  }

  return {
    pass: failReasons.length === 0,
    failReasons
  };
}
