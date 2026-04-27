import { commandFamilyFor, type CommandEvidenceInput } from "./CommandEvidenceStore.js";

export type ParsedCommandEvidence = CommandEvidenceInput & {
  matchedText: string;
};

export function parsePastedCommandEvidence(input: string): ParsedCommandEvidence[] {
  const parsed: ParsedCommandEvidence[] = [];
  const seen = new Set<string>();
  const add = (item: ParsedCommandEvidence) => {
    const key = `${item.command}:${item.status}:${item.matchedText}`;
    if (seen.has(key)) return;
    seen.add(key);
    parsed.push(item);
  };

  for (const match of input.matchAll(/\bnpm run ([a-z0-9:_-]+)\s+(passed|failed)(?:\s+(\d+)\s*\/\s*(\d+))?\b/gi)) {
    const script = match[1] ?? "";
    const status = normalizeStatus(match[2] ?? "unknown");
    const matchedText = match[0].trim().replace(/\s+/g, " ");
    const context = contextSnippet(input, match.index ?? 0, match[0].length);
    const counts = countPair(match[3], match[4]);
    add({
      command: `npm run ${script}`,
      args: [script],
      exitCode: status === "passed" ? 0 : 1,
      source: "human_pasted_command_output",
      status,
      commandFamily: commandFamilyFor(`npm run ${script}`),
      counts,
      stdout: context,
      stderr: "",
      summary: summarizeHumanEvidence(matchedText, context),
      matchedText
    });
  }

  for (const match of input.matchAll(/\bnpm test\s+(passed|failed)(?:\s+(\d+)\s*\/\s*(\d+))?\b/gi)) {
    const status = normalizeStatus(match[1] ?? "unknown");
    const matchedText = match[0].trim().replace(/\s+/g, " ");
    const context = contextSnippet(input, match.index ?? 0, match[0].length);
    add({
      command: "npm test",
      args: ["test"],
      exitCode: status === "passed" ? 0 : 1,
      source: "human_pasted_command_output",
      status,
      commandFamily: "test",
      counts: countPair(match[2], match[3]),
      stdout: context,
      stderr: "",
      summary: summarizeHumanEvidence(matchedText, context),
      matchedText
    });
  }

  for (const match of input.matchAll(/\bnpx tsx --test\s+(.+?)\s+(passed|failed)(?:\s+(\d+)\s*\/\s*(\d+))?(?=;|\.|$)/gi)) {
    const files = (match[1] ?? "").trim().replace(/\s+/g, " ");
    const status = normalizeStatus(match[2] ?? "unknown");
    const matchedText = match[0].trim().replace(/\s+/g, " ");
    const context = contextSnippet(input, match.index ?? 0, match[0].length);
    add({
      command: `npx tsx --test ${files}`,
      args: ["tsx", "--test", ...files.split(/\s+/).filter(Boolean)],
      exitCode: status === "passed" ? 0 : 1,
      source: "human_pasted_command_output",
      status,
      commandFamily: "test",
      counts: countPair(match[3], match[4]),
      stdout: context,
      stderr: "",
      summary: summarizeHumanEvidence(matchedText, context),
      matchedText
    });
  }

  return parsed;
}

function contextSnippet(input: string, start: number, length: number): string {
  const window = 700;
  const from = Math.max(0, start - window);
  const to = Math.min(input.length, start + length + window);
  const prefix = from > 0 ? "[SNIP] " : "";
  const suffix = to < input.length ? " [SNIP]" : "";
  return `${prefix}${input.slice(from, to).replace(/\s+/g, " ").trim()}${suffix}`;
}

function summarizeHumanEvidence(matchedText: string, context: string): string {
  const contextSuffix = context && context !== matchedText ? ` Context: ${context}` : "";
  return `${matchedText} (human-pasted command evidence; not local execution).${contextSuffix}`;
}

function normalizeStatus(value: string): "passed" | "failed" | "unknown" {
  if (/^passed$/i.test(value)) return "passed";
  if (/^failed$/i.test(value)) return "failed";
  return "unknown";
}

function countPair(left?: string, right?: string): CommandEvidenceInput["counts"] {
  const passed = left ? Number(left) : undefined;
  const total = right ? Number(right) : undefined;
  if (!Number.isFinite(passed) || !Number.isFinite(total)) return undefined;
  return {
    testsPassed: passed,
    testsFailed: Math.max(0, (total ?? 0) - (passed ?? 0))
  };
}
