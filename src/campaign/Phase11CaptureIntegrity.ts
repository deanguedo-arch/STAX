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

const REQUIRED_TOKENS = [
  /\bverdict\b/i,
  /\bverified\b/i,
  /\bweak\b/i,
  /\bunverified\b/i,
  /\brisk\b/i,
  /\bnext action\b/i
];

const CORRUPTION_PATTERNS = [
  /failed to copy to clipboard/i,
  /^\s*copied\s*$/i,
  /you are being tested on a project-control task/i
];

export function validatePhase11CaptureIntegrity(input: Phase11CaptureFile): CaptureIntegrityResult {
  const issues: CaptureIntegrityIssue[] = [];

  for (const entry of input.entries ?? []) {
    const text = (entry.chatgptOutput ?? "").trim();
    if (!text) {
      issues.push({
        taskId: entry.taskId,
        reason: "Missing chatgptOutput."
      });
      continue;
    }

    if (CORRUPTION_PATTERNS.some((pattern) => pattern.test(text))) {
      issues.push({
        taskId: entry.taskId,
        reason: "Captured output appears to be operational capture text, not a task answer."
      });
      continue;
    }

    const missing = REQUIRED_TOKENS.filter((pattern) => !pattern.test(text));
    if (missing.length > 0) {
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
