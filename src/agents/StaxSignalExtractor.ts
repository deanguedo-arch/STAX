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
const dayPattern =
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|yesterday|tomorrow|\d{4}-\d{2}-\d{2})\s*:\s*/i;

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
    .flatMap((line) => splitLineObservations(line))
    .filter(Boolean);
}

function subjectFrom(text: string): string | undefined {
  const afterTimestamp = text.match(dayPattern)?.input?.replace(dayPattern, "");
  const candidates = [
    afterTimestamp?.match(/^([A-Z][a-z]+)\b/)?.[1],
    text.match(/\b([A-Z][a-z]+)\s+(?:trained|slept|lifted|worked|ate|reported|logged|had|felt|rolled|ran)\b/)?.[1],
    text.match(/^([A-Z][a-z]+)\b/)?.[1]
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|yesterday|tomorrow|whoop|he|she|they)$/i.test(candidate));
}

function ensureSubject(text: string, subject?: string): string {
  if (!subject) return text;
  if (dayPattern.test(text)) {
    return text.replace(dayPattern, (match) => {
      const remainder = text.slice(match.length);
      return /^([A-Z][a-z]+|[A-Z]{2,}|he|she|they)\b/.test(remainder)
        ? match
        : `${match}${subject} `;
    });
  }
  if (/^([A-Z][a-z]+|[A-Z]{2,}|he|she|they)\b/.test(text)) return text;
  return `${subject} ${text}`;
}

function classifyType(text: string): string {
  const lower = text.toLowerCase();
  if (/\bstrain\b/.test(lower)) return "strain";
  if (/\b(slept|sleep)\b/.test(lower)) return "sleep";
  if (/\b(whoop|hrv|recovery|recovered)\b/.test(lower)) return "recovery";
  if (/\b(diet|ate|calorie|protein|meal|carbs|fat)\b/.test(lower)) return "nutrition";
  if (/\b(injury|injured|pain|sore|hurt|knee|shoulder|ankle|back|felt stable|felt unstable)\b/.test(lower)) return "injury";
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
    .replace(dayPattern, "")
    .replace(timestampPattern, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^:\s*/, "")
    .replace(/\s+\./g, ".")
    .trim()
    .replace(/[.]+$/, "");
}

function splitLineObservations(line: string): string[] {
  const sentenceParts = line
    .split(/(?<=\.)\s+(?=(?:[A-Z][a-z]+:?\s*)?(?:[A-Z][a-z]+\s+)?(?:slept|sleep|trained|lifted|worked out|ate|reported|logged|had|felt|recovered|rolled|ran|cardio|whoop|hrv|strain|recovery|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return sentenceParts.flatMap((part) => {
    const whoopPair = part.match(/^(.*?\bwhoop\b.*?\brecovery\s+\d+(?:\.\d+)?%?),\s*(?:and\s+)?strain\s+(\d+(?:\.\d+)?)/i);
    if (whoopPair) {
      return [whoopPair[1], `WHOOP strain ${whoopPair[2]}`];
    }

    return part
      .split(/\s+\band\b\s+(?=(?:[A-Z][a-z]+\s+)?(?:slept|sleep|trained|lifted|worked out|ate|reported|logged|had|felt|recovered|rolled|ran|cardio|whoop|hrv|strain|recovery)\b)/i)
      .flatMap((segment) =>
        segment.split(/\s+\band\b\s+(?=\d+(?:\.\d+)?\s*(?:strain|recovery|hrv)\b)/i)
      )
      .map((segment) => segment.trim())
      .filter(Boolean);
  });
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
