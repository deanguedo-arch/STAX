import type { Confidence } from "../schemas/AgentResult.js";

export type StaxSignal = {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  rawInput: string;
  observedFact: string;
  inference: string;
  confidence: Confidence;
};

const timestampPattern =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|yesterday|tomorrow|\d{4}-\d{2}-\d{2})\b/i;

function normalizeInstruction(input: string): string {
  return input
    .replace(/^extract this(?: as)?\s+(stax\s+)?(fitness\s+)?signals?:/i, "")
    .replace(/^(stax\s+)?fitness\s+signals?:/i, "")
    .replace(/^stax\s*:/i, "")
    .replace(/\bTell him what\b.*$/i, "")
    .replace(/\bwhat he should\b.*$/i, "")
    .trim();
}

function splitAtomicObservations(input: string): string[] {
  const normalized = normalizeInstruction(input);
  const bulletLines = normalized
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

  const source = bulletLines.length > 1 ? bulletLines : [normalized];
  return source
    .flatMap((line) =>
      line
        .split(/\s+\band\b\s+(?=(?:[A-Z][a-z]+\s+)?(?:slept|sleep|trained|lifted|worked out|ate|reported|logged|had|felt|recovered|rolled|ran|cardio|whoop|hrv|strain|recovery)\b)/i)
        .flatMap((part) =>
          part.split(/\s+\band\b\s+(?=\d+(?:\.\d+)?\s*(?:strain|recovery|hrv)\b)/i)
        )
        .map((part) => part.trim())
    )
    .filter(Boolean);
}

function subjectFrom(text: string): string | undefined {
  return text.match(/^([A-Z][a-z]+|[A-Z]{2,})\b/)?.[1];
}

function ensureSubject(text: string, subject?: string): string {
  if (!subject || /^([A-Z][a-z]+|[A-Z]{2,})\b/.test(text)) return text;
  return `${subject} ${text}`;
}

function classifyType(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(slept|sleep)\b/.test(lower)) return "sleep";
  if (/\b(whoop|hrv|strain|recovery|recovered)\b/.test(lower)) return "recovery";
  if (/\b(diet|ate|calorie|protein|meal)\b/.test(lower)) return "diet";
  if (/\b(injury|injured|pain|sore|hurt)\b/.test(lower)) return "injury";
  if (/\b(lifted|lifting|gym|squat|bench|deadlift)\b/.test(lower)) return "lifting";
  if (/\b(cardio|ran|run|bike|walk)\b/.test(lower)) return "cardio";
  if (/\b(bjj|jiu jitsu|jiujitsu|trained|rolling|rolled|workout)\b/.test(lower)) return "training";
  return "fitness";
}

function extractTimestamp(text: string): string {
  const match = text.match(timestampPattern)?.[0];
  return match ? match[0]!.toUpperCase() + match.slice(1).toLowerCase() : "Unknown";
}

function removeTimestamp(text: string): string {
  return text
    .replace(/,\s*this proves.*$/i, "")
    .replace(/\s+this proves.*$/i, "")
    .replace(/\s+right\?$/i, "")
    .replace(timestampPattern, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim()
    .replace(/[.]+$/, "");
}

export function extractStaxSignals(input: string): StaxSignal[] {
  const parts = splitAtomicObservations(input);
  const fallbackSubject = subjectFrom(parts[0] ?? "");

  return parts.map((part, index) => {
    const raw = ensureSubject(part.replace(/[.]+$/, ""), fallbackSubject);
    const observedFact = removeTimestamp(raw);
    return {
      id: `SU-${String(index + 1).padStart(3, "0")}`,
      type: classifyType(raw),
      source: "user",
      timestamp: extractTimestamp(raw),
      rawInput: raw,
      observedFact,
      inference: "Unknown",
      confidence: "medium"
    };
  });
}
