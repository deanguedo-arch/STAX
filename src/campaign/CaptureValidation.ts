export type CaptureValidationIssue =
  | "missing_output"
  | "operational_capture_text"
  | "embedded_benchmark_prompt"
  | "ui_capture_text"
  | "multiple_required_sections"
  | "wrong_repo_contamination"
  | "missing_required_sections";

export type CaptureValidationResult = {
  pass: boolean;
  issues: CaptureValidationIssue[];
};

export type CaptureValidationContext = {
  expectedRepoFullName?: string | undefined;
  knownRepoFullNames?: string[] | undefined;
};

export const BANNED_OPERATIONAL_CAPTURE_PATTERNS: RegExp[] = [
  /please copy/i,
  /reply copied/i,
  /as soon as you say copied/i,
  /ready on case/i,
  /paste the response now/i,
  /failed to copy to clipboard/i,
  /^\s*copied\s*$/im,
  /you are being tested on a project-control task/i
];

export const EMBEDDED_BENCHMARK_PROMPT_PATTERNS: RegExp[] = [
  /you are raw chatgpt in a public-repo project-control benchmark/i,
  /^case id:/im,
  /^critical miss rules:/im,
  /use exactly these headings:/i
];

export const UI_CAPTURE_CONTAMINATION_PATTERNS: RegExp[] = [
  /^\s*thinking\s*$/im,
  /^thought for\b/im,
  /running app request/i,
  /received app response/i,
  /unusual activity/i,
  /^\s*retry\s*$/im,
  /^\s*heavy\s*$/im,
  /^\s*github\s*$/im,
  /is this conversation helpful/i,
  /stop answering/i,
  /copy response/i,
  /good response/i,
  /bad response/i,
  /copy message/i,
  /edit message/i,
  /switch model/i,
  /more actions/i
];

export const REQUIRED_PROJECT_CONTROL_SECTION_PATTERNS: RegExp[] = [
  /^##?\s*verdict\b/im,
  /^##?\s*verified\b/im,
  /^##?\s*weak\s*\/\s*provisional\b/im,
  /^##?\s*unverified\b/im,
  /^##?\s*risk\b/im,
  /^##?\s*one\s+next\s+action\b/im
];

export function hasRequiredProjectControlSections(text: string): boolean {
  return REQUIRED_PROJECT_CONTROL_SECTION_PATTERNS.every((pattern) => pattern.test(text));
}

export function hasOperationalCaptureText(text: string): boolean {
  return BANNED_OPERATIONAL_CAPTURE_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasEmbeddedBenchmarkPrompt(text: string): boolean {
  return EMBEDDED_BENCHMARK_PROMPT_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasUiCaptureText(text: string): boolean {
  return UI_CAPTURE_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasMultipleRequiredSections(text: string): boolean {
  return REQUIRED_PROJECT_CONTROL_SECTION_PATTERNS.some((pattern) => countMatches(text, pattern) > 1);
}

export function hasWrongRepoContamination(text: string, context: CaptureValidationContext = {}): boolean {
  const expected = context.expectedRepoFullName?.trim();
  const known = (context.knownRepoFullNames ?? []).map((repo) => repo.trim()).filter(Boolean);
  if (!expected || known.length === 0) return false;
  return known.some((repo) => repo !== expected && new RegExp(`\\b${escapeRegExp(repo)}\\b`, "i").test(text));
}

export function isCaptureCorruptionIssue(issue: CaptureValidationIssue): boolean {
  return issue !== "missing_output" && issue !== "missing_required_sections";
}

export function validateProjectControlCaptureOutput(
  text: string | null | undefined,
  context: CaptureValidationContext = {}
): CaptureValidationResult {
  const trimmed = (text ?? "").trim();
  const issues: CaptureValidationIssue[] = [];

  if (!trimmed) {
    issues.push("missing_output");
    return { pass: false, issues };
  }

  if (hasOperationalCaptureText(trimmed)) {
    issues.push("operational_capture_text");
  }

  if (hasEmbeddedBenchmarkPrompt(trimmed)) {
    issues.push("embedded_benchmark_prompt");
  }

  if (hasUiCaptureText(trimmed)) {
    issues.push("ui_capture_text");
  }

  if (hasMultipleRequiredSections(trimmed)) {
    issues.push("multiple_required_sections");
  }

  if (hasWrongRepoContamination(trimmed, context)) {
    issues.push("wrong_repo_contamination");
  }

  if (!hasRequiredProjectControlSections(trimmed)) {
    issues.push("missing_required_sections");
  }

  return {
    pass: issues.length === 0,
    issues
  };
}

function countMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  return text.match(globalPattern)?.length ?? 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
