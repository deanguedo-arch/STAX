import { validateProjectControlCaptureOutput } from "./CaptureValidation.js";

export type Phase11CaptureEntry = {
  taskId: string;
  chatgptOutput: string | null;
};

export type Phase11CaptureFile = {
  campaignId: string;
  entries: Phase11CaptureEntry[];
};

export type CaptureIntegrityIssue = {
  taskId: string;
  reason: string;
};

export type CaptureIntegrityResult = {
  pass: boolean;
  issues: CaptureIntegrityIssue[];
};

export function validatePhase11CaptureIntegrity(input: Phase11CaptureFile): CaptureIntegrityResult {
  const issues: CaptureIntegrityIssue[] = [];

  for (const entry of input.entries ?? []) {
    const result = validateProjectControlCaptureOutput(entry.chatgptOutput);
    if (result.issues.includes("missing_output")) {
      issues.push({
        taskId: entry.taskId,
        reason: "Missing chatgptOutput."
      });
      continue;
    }

    if (result.issues.includes("operational_capture_text")) {
      issues.push({
        taskId: entry.taskId,
        reason: "Captured output appears to be operational capture text, not a task answer."
      });
    }

    if (result.issues.includes("missing_required_sections")) {
      issues.push({
        taskId: entry.taskId,
        reason: "Captured output is missing required project-control sections."
      });
    }
  }

  return {
    pass: issues.length === 0,
    issues
  };
}
