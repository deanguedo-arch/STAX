import type { RaxMode } from "../schemas/Config.js";

export type ModeDetection = {
  mode: RaxMode;
  confidence: number;
  matchedTerms: string[];
  fallbackUsed: boolean;
};

const MODE_TERMS: Record<RaxMode, string[]> = {
  intake: ["extract", "ingest", "signal", "observation", "log", "raw input", "capture"],
  analysis: ["analyze", "pattern", "compare", "deviation", "summary", "interpret", "evaluate"],
  planning: ["build", "plan", "implement", "project", "scaffold", "roadmap", "architecture"],
  audit: ["review", "check", "critique", "validate", "inspect", "test", "find gaps"],
  stax_fitness: [
    "fitness",
    "jiu jitsu",
    "jiujitsu",
    "bjj",
    "lifting",
    "workout",
    "sleep",
    "recovery",
    "diet",
    "nutrition",
    "injury",
    "whoop",
    "training signal"
  ],
  code_review: ["code", "repo", "pull request", "bug", "refactor", "typescript", "python", "test failure"],
  teaching: ["explain", "teach", "understand", "how does", "why"],
  general_chat: [],
  project_brain: [
    "project brain",
    "project state",
    "proven working",
    "unproven claims",
    "risk register",
    "next actions"
  ],
  codex_audit: [
    "codex audit",
    "codex says",
    "codex claim",
    "fake-complete",
    "missing evidence",
    "tests pass but"
  ],
  prompt_factory: [
    "codex prompt",
    "prompt factory",
    "surgical prompt",
    "files to inspect",
    "acceptance criteria"
  ],
  test_gap_audit: [
    "test gap",
    "missing tests",
    "negative cases",
    "eval cases",
    "coverage gap"
  ],
  policy_drift: [
    "policy drift",
    "weakened policy",
    "disabled critic",
    "schema validation disabled",
    "unsafe tools"
  ],
  learning_unit: [
    "learning unit",
    "approved learning loop",
    "learning loop",
    "self organize",
    "adapt over time",
    "improve over time",
    "gets better over time",
    "learning event",
    "learning queue",
    "promotion gate",
    "stax system",
    "system improvement",
    "runtime",
    "schema",
    "eval",
    "correction",
    "trace",
    "queue",
    "promotion"
  ],
  model_comparison: [
    "model comparison",
    "compare external",
    "external answer",
    "chatgpt answer",
    "stax answer",
    "which answer is better",
    "compare answers",
    "better answer for this project"
  ]
};

export class ModeDetector {
  detect(input: string): ModeDetection {
    const text = input.toLowerCase();
    const strongLearningTerms = [
      "learning unit",
      "approved learning loop",
      "learning loop",
      "learning event",
      "learning queue",
      "promotion gate",
      "self organize",
      "adapt over time",
      "improve over time",
      "gets better over time"
    ];
    const strongLearningMatches = strongLearningTerms.filter((term) => text.includes(term));
    if (strongLearningMatches.length > 0) {
      return {
        mode: "learning_unit",
        confidence: Math.min(0.95, 0.65 + strongLearningMatches.length * 0.1),
        matchedTerms: strongLearningMatches,
        fallbackUsed: false
      };
    }

    const staxStrongTerms = [
      "fitness",
      "jiu jitsu",
      "jiujitsu",
      "bjj",
      "lifting",
      "workout",
      "recovery",
      "diet",
      "nutrition",
      "injury",
      "whoop",
      "training signal"
    ];
    const strongStaxMatches = staxStrongTerms.filter((term) => text.includes(term));
    if (strongStaxMatches.length > 0) {
      return {
        mode: "stax_fitness",
        confidence: Math.min(0.95, 0.55 + strongStaxMatches.length * 0.1),
        matchedTerms: [
          ...strongStaxMatches,
          ...MODE_TERMS.stax_fitness.filter((term) => term === "sleep" && text.includes(term))
        ],
        fallbackUsed: false
      };
    }

    const priority: Record<RaxMode, number> = {
      policy_drift: 13,
      codex_audit: 12,
      project_brain: 11,
      test_gap_audit: 10,
      prompt_factory: 9,
      planning: 8,
      stax_fitness: 7,
      code_review: 6,
      audit: 5,
      analysis: 4,
      intake: 3,
      teaching: 2,
      general_chat: 1,
      learning_unit: 14,
      model_comparison: 12
    };

    const ranked = Object.entries(MODE_TERMS)
      .filter(([mode]) => mode !== "general_chat")
      .map(([mode, terms]) => {
        const matchedTerms = terms.filter((term) => text.includes(term));
        return {
          mode: mode as RaxMode,
          matchedTerms,
          confidence: Math.min(0.99, matchedTerms.length / Math.max(3, terms.length / 2))
        };
      })
      .sort(
        (a, b) =>
          b.confidence - a.confidence ||
          b.matchedTerms.length - a.matchedTerms.length ||
          priority[b.mode] - priority[a.mode]
      );

    const best = ranked[0];
    if (!best || best.confidence < 0.25) {
      return {
        mode: "analysis",
        confidence: 0.2,
        matchedTerms: [],
        fallbackUsed: true
      };
    }

    return {
      mode: best.mode,
      confidence: Number(best.confidence.toFixed(2)),
      matchedTerms: best.matchedTerms,
      fallbackUsed: false
    };
  }
}
