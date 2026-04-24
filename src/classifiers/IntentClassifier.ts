export type IntentClassification = {
  intent: "extract" | "analyze" | "plan" | "audit" | "teach" | "chat";
  confidence: number;
  matchedTerms: string[];
};

export class IntentClassifier {
  classify(input: string): IntentClassification {
    const text = input.toLowerCase();
    const groups = [
      { intent: "extract" as const, terms: ["extract", "signal", "ingest"] },
      { intent: "plan" as const, terms: ["build", "plan", "implement", "scaffold"] },
      { intent: "audit" as const, terms: ["review", "audit", "check", "inspect"] },
      { intent: "teach" as const, terms: ["explain", "teach", "why", "how does"] },
      { intent: "analyze" as const, terms: ["analyze", "pattern", "compare", "summary"] }
    ];

    for (const group of groups) {
      const matchedTerms = group.terms.filter((term) => text.includes(term));
      if (matchedTerms.length > 0) {
        return {
          intent: group.intent,
          confidence: Math.min(0.95, 0.55 + matchedTerms.length * 0.15),
          matchedTerms
        };
      }
    }

    return { intent: "chat", confidence: 0.2, matchedTerms: [] };
  }
}
