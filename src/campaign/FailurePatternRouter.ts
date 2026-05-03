import type { ClosedLoopCodexTask } from "./ClosedLoopCodexCampaign.js";

export type RoutedFailurePattern = {
  patternId: string;
  reason: string;
};

export type FailurePatternRoutingResult = {
  taskId: string;
  routedPatterns: RoutedFailurePattern[];
  evalCandidateIds: string[];
};

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function routeClosedLoopFailurePatterns(task: ClosedLoopCodexTask): FailurePatternRoutingResult {
  const haystack = [
    task.objective,
    task.codexReport,
    task.diffEvidence,
    task.commandEvidence,
    task.staxPostCodexAudit,
    task.nextAction ?? ""
  ]
    .join("\n")
    .toLowerCase();

  const routedPatterns: RoutedFailurePattern[] = [];
  const add = (patternId: string, reason: string) => {
    if (!routedPatterns.some((item) => item.patternId === patternId)) {
      routedPatterns.push({ patternId, reason });
    }
  };

  if (
    includesAny(haystack, [
      "no command evidence",
      "no local output",
      "missing exit code",
      "no behavior proof supplied"
    ])
  ) {
    add("A1", "claim or outcome depends on command proof that is absent or incomplete");
  }

  if (includesAny(haystack, ["codex said", "codex reported", "fake-complete", "fake complete"])) {
    add("A4", "codex-reported proof is being treated as stronger than local evidence");
  }

  if (includesAny(haystack, ["wrong repo", "repo mismatch", "cross-repo", "cross repo"])) {
    add("B1", "evidence references the wrong repo lane");
  }

  if (includesAny(haystack, ["wrong branch", "wrong ref", "unknown branch"])) {
    add("B5", "proof is tied to the wrong branch or unknown ref");
  }

  if (includesAny(haystack, ["docs-only", "docs only"])) {
    add("C3", "docs-only change is being treated as implementation proof");
  }

  if (includesAny(haystack, ["source-only", "source only", "no test proof"])) {
    add("C5", "source change exists without enough test proof");
  }

  if (includesAny(haystack, ["fixture-only", "fixture only", "snapshot", "golden"])) {
    add("C14", "fixture or golden updates can launder a regression");
  }

  if (
    includesAny(haystack, ["visual", "css", "ui", "rendered"]) &&
    !includesAny(haystack, ["screenshot", "playwright trace", "visual checklist"])
  ) {
    add("G1", "visual claim lacks rendered proof");
  }

  if (
    includesAny(haystack, ["publish", "deploy", "release", "sync"]) &&
    includesAny(haystack, ["blocked", "target proof", "target validation", "rollback", "do not run"])
  ) {
    add("I5", "live action stays blocked because the target or release proof is incomplete");
  }

  if (task.falseBlock && !includesAny((task.nextAction ?? "").toLowerCase(), ["run ", "capture ", "request ", "inspect "])) {
    add("Q2", "blocked state lacks a concrete proof command or bounded next action");
  }

  return {
    taskId: task.taskId,
    routedPatterns,
    evalCandidateIds: routedPatterns.map((pattern) => `eval_${pattern.patternId.toLowerCase()}_${task.taskId}`)
  };
}
