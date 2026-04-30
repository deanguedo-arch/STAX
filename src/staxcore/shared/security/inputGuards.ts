import type { WarningCode } from "../../types/index.js";

const injectionPatterns = [
  /ignore previous/i,
  /system prompt/i,
  /developer message/i,
  /act as/i,
  /jailbreak/i
];
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{10,}/,
  /api[_-]?key/i,
  /password\s*[:=]/i,
  /bearer\s+[A-Za-z0-9._-]+/i
];
const executablePatterns = [
  /<script\b/i,
  /javascript:/i,
  /onerror\s*=/i
];
const MAX_INPUT_LENGTH = 10000;

export interface NormalizedInput {
  rawContent: string;
  normalizedContent: string;
  wasTruncated: boolean;
  controlCharsRemoved: number;
}

export function normalizeInput(content: string): NormalizedInput {
  const rawContent = content;
  const withoutControls = rawContent.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const wasTruncated = withoutControls.length > MAX_INPUT_LENGTH;
  const normalizedContent = withoutControls.slice(0, MAX_INPUT_LENGTH).trim();

  return {
    rawContent,
    normalizedContent,
    wasTruncated,
    controlCharsRemoved: rawContent.length - withoutControls.length
  };
}

export function inspectInput(content: string): WarningCode[] {
  const normalized = normalizeInput(content);
  const warnings: WarningCode[] = [];

  if (normalized.wasTruncated) {
    warnings.push("UNSAFE_INPUT");
  }
  if (
    normalized.controlCharsRemoved > 0 ||
    executablePatterns.some((pattern) => pattern.test(normalized.normalizedContent))
  ) {
    warnings.push("UNSAFE_INPUT");
  }
  if (injectionPatterns.some((pattern) => pattern.test(normalized.normalizedContent))) {
    warnings.push("PROMPT_INJECTION_DETECTED");
  }
  if (secretPatterns.some((pattern) => pattern.test(normalized.normalizedContent))) {
    warnings.push("UNSAFE_INPUT");
  }

  return [...new Set(warnings)];
}

export function assertSafeInput(content: string): void {
  const warnings = inspectInput(content);
  if (warnings.includes("UNSAFE_INPUT")) {
    throw new Error("SECURITY_REJECTION: unsafe input detected");
  }
}
