import type { SidecarLearningEvent } from "./SidecarLearningEvent.js";

export type SidecarRedactionResult = {
  status: "clean" | "redacted" | "blocked";
  notes: string[];
  text: string;
};

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, "bearer token"],
  [/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}["']?/gi, "secret assignment"],
  [/\bsk-[A-Za-z0-9]{20,}\b/g, "OpenAI-style API key"],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "GitHub token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "private key"]
];

export function redactSidecarText(input: string, options: { redactAbsolutePaths?: boolean } = {}): SidecarRedactionResult {
  let text = input;
  const notes: string[] = [];
  let blocked = false;

  if (/^\s*[A-Za-z0-9_]+=.+=?/m.test(text) && /\b(?:password|secret|token|api[_-]?key)\b/i.test(text)) {
    blocked = true;
    notes.push(".env-like secret content detected");
  }

  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      notes.push(`${label} redacted`);
      text = text.replace(pattern, `[REDACTED ${label.toUpperCase()}]`);
    }
  }

  if (/\b(?:student|client|patient|ssn)\s*(?:id|name|email)\b/i.test(text)) {
    notes.push("private identifier label redacted");
    text = text.replace(/\b(?:student|client|patient|ssn)\s*(?:id|name|email)\b/gi, "[REDACTED PRIVATE IDENTIFIER]");
  }

  if (options.redactAbsolutePaths) {
    const before = text;
    text = text.replace(/\/Users\/[^/\s]+\/[^\s"')]+/g, "[REDACTED ABSOLUTE PATH]");
    text = text.replace(/[A-Za-z]:\\Users\\[^\\\s]+\\[^\s"')]+/g, "[REDACTED ABSOLUTE PATH]");
    if (text !== before) notes.push("absolute path redacted");
  }

  return {
    status: blocked ? "blocked" : notes.length > 0 ? "redacted" : "clean",
    notes: [...new Set(notes)],
    text
  };
}

export function redactSidecarLearningEvent(event: SidecarLearningEvent): SidecarLearningEvent {
  const raw = JSON.stringify(event);
  const result = redactSidecarText(raw, { redactAbsolutePaths: true });
  if (result.status === "clean") return event;
  const redacted = JSON.parse(result.text) as SidecarLearningEvent;
  return {
    ...redacted,
    privacy: {
      redactionStatus: result.status,
      redactionNotes: [...new Set([...(event.privacy.redactionNotes ?? []), ...result.notes])]
    }
  };
}
