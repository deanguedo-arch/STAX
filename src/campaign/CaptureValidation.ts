export type CaptureValidationIssue =
  | "missing_output"
  | "operational_capture_text"
  | "missing_required_sections";

export type CaptureValidationResult = {
  pass: boolean;
  issues: CaptureValidationIssue[];
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

export function validateProjectControlCaptureOutput(text: string | null | undefined): CaptureValidationResult {
  const trimmed = (text ?? "").trim();
  const issues: CaptureValidationIssue[] = [];

  if (!trimmed) {
    issues.push("missing_output");
    return { pass: false, issues };
  }

  if (hasOperationalCaptureText(trimmed)) {
    issues.push("operational_capture_text");
  }

  if (!hasRequiredProjectControlSections(trimmed)) {
    issues.push("missing_required_sections");
  }

  return {
    pass: issues.length === 0,
    issues
  };
}
