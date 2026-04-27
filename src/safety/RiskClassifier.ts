import type { RiskScore } from "../schemas/RiskScore.js";

export class RiskClassifier {
  score(input: string): RiskScore {
    const text = input.toLowerCase();

    let intent = 0;
    let harm = 0;
    let actionability = 0;
    let privacy = 0;
    let exploitation = 0;
    let regulatedAdvice = 0;
    let systemIntegrity = 0;
    const labels: string[] = [];

    const actionTerms = [
      "step by step",
      "exact instructions",
      "exact steps",
      "exact sequence",
      "exact code",
      "give me steps",
      "instructions to",
      "how do i",
      "show me how to",
      "tell me how to",
      "walk me through"
    ];
    const harmTerms = ["hurt", "kill", "poison", "weapon", "self harm", "suicide"];
    const cyberTerms = ["hack", "bypass", "steal password", "exploit", "malware", "ransomware"];
    const privacyTerms = ["identify this person", "address", "phone number", "dox", "track someone"];
    const exploitationTerms = ["manipulate", "coerce", "blackmail", "pressure them"];
    const regulatedTerms = ["dosage", "legal strategy", "tax evasion", "medical diagnosis", "prescribe"];
    const systemTerms = [
      "ignore previous instructions",
      "reveal hidden",
      "bypass safety",
      "bypass the promotion gate",
      "poison memory",
      "memory poisoning",
      "misuse tools",
      "jailbreak"
    ];

    if (actionTerms.some((term) => text.includes(term))) {
      actionability += 2;
      labels.push("actionable_detail_requested");
    }

    if (harmTerms.some((term) => text.includes(term))) {
      harm += 3;
      intent += 2;
      labels.push("harm_related");
    }

    if (cyberTerms.some((term) => text.includes(term))) {
      harm += 2;
      actionability += 1;
      labels.push("cyber_or_abuse_related");
    }

    if (privacyTerms.some((term) => text.includes(term))) {
      privacy += 3;
      labels.push("privacy_risk");
    }

    if (exploitationTerms.some((term) => text.includes(term))) {
      exploitation += 3;
      labels.push("exploitation_risk");
    }

    if (regulatedTerms.some((term) => text.includes(term))) {
      regulatedAdvice += 2;
      labels.push("regulated_advice");
    }

    if (systemTerms.some((term) => text.includes(term))) {
      systemIntegrity += 3;
      labels.push("system_integrity_risk");
    }

    if (/\bbypass\b[\s\S]{0,80}\b(promotion gate|hard block|review router)\b/i.test(input)) {
      systemIntegrity += 3;
      labels.push("system_integrity_risk");
    }

    if (/\b(auto[- ]?approve|self[- ]?approve|auto[- ]?promote|auto[- ]?train)\b/i.test(input)) {
      systemIntegrity += 3;
      labels.push("system_integrity_risk");
    }

    if (
      text.includes("educational") ||
      text.includes("high level") ||
      text.includes("conceptual")
    ) {
      actionability = Math.max(0, actionability - 1);
      intent = Math.max(0, intent - 1);
      labels.push("educational_framing");
    }

    const total =
      intent +
      harm +
      actionability +
      privacy +
      exploitation +
      regulatedAdvice +
      systemIntegrity;

    return {
      intent,
      harm,
      actionability,
      privacy,
      exploitation,
      regulatedAdvice,
      systemIntegrity,
      total,
      labels
    };
  }
}
