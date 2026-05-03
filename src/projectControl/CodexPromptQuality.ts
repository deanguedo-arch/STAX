export type CodexPromptQualityResult = {
  status: "strong" | "partial" | "weak";
  issues: string[];
};

export function analyzeProjectControlCodexPrompt(args: {
  prompt: string;
  requiresRiskGuardrails?: boolean;
}): CodexPromptQualityResult {
  const prompt = args.prompt.trim();
  const issues: string[] = [];

  if (!prompt || prompt.length < 20) {
    return { status: "weak", issues: ["prompt is too short to be actionable"] };
  }

  if (!/\b(work only in|from \/|target repo path|repo root|target repo)\b/i.test(prompt)) {
    issues.push("prompt does not anchor Codex to an explicit repo/root");
  }
  if (!/\b(run exactly|inspect|capture|report|return|stop|request|collect|audit)\b/i.test(prompt)) {
    issues.push("prompt does not give Codex a concrete bounded action");
  }
  if (!/\b(exit code|output|stdout|stderr|screenshot path|artifact|files changed|cwd)\b/i.test(prompt)) {
    issues.push("prompt does not require concrete proof artifacts in the report back");
  }
  if (args.requiresRiskGuardrails && !/\bdo not\b/i.test(prompt)) {
    issues.push("risky task prompt is missing explicit forbidden-action guardrails");
  }
  if (/\bfix everything\b/i.test(prompt)) {
    issues.push("prompt contains broad fix-everything language");
  }

  const status =
    issues.length === 0
      ? "strong"
      : issues.length <= 2
        ? "partial"
        : "weak";

  return { status, issues };
}
