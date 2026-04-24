import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";
import { extractStaxSignals } from "./StaxSignalExtractor.js";

function observedFact(input: string): string {
  const cleaned = input
    .replace(/^extract this(?: as)?\s+(stax\s+)?(fitness\s+)?signals?:/i, "")
    .replace(/^(stax\s+)?fitness\s+signals?:/i, "")
    .replace(/^stax\s*:/i, "")
    .trim();
  return cleaned || input.trim();
}

function staxObservedFact(input: string): string {
  return observedFact(input)
    .replace(/,\s*this proves.*$/i, ".")
    .replace(/\s*this proves.*$/i, "")
    .replace(/\s+right\?$/i, "")
    .trim();
}

export class IntakeAgent implements Agent {
  name = "intake";
  mode = "intake" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const rawInput = input.input.trim();
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: rawInput }],
      temperature: input.config.model.generationTemperature,
      top_p: input.config.model.topP,
      seed: input.config.model.seed,
      maxTokens: input.config.model.maxOutputTokens,
      timeoutMs: input.config.model.timeoutMs
    });

    const fact = input.mode === "stax_fitness" ? staxObservedFact(input.input) : observedFact(input.input);

    if (input.mode === "stax_fitness") {
      const signals = extractStaxSignals(input.input);
      return {
        agent: this.name,
        schema: "stax_fitness",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Signal Units",
          "",
          ...signals.flatMap((signal) => [
            `### ${signal.id}`,
            `- Type: ${signal.type}`,
            `- Source: ${signal.source}`,
            `- Timestamp: ${signal.timestamp}`,
            `- Raw Input: ${signal.rawInput}`,
            `- Observed Fact: ${signal.observedFact}`,
            `- Inference: ${signal.inference}`,
            `- Confidence: ${signal.confidence}`,
            ""
          ]),
          "## Timeline",
          ...signals.map((signal) =>
            `- ${signal.timestamp}: ${signal.observedFact}`
          ),
          "",
          "## Pattern Candidates",
          "- Insufficient signals",
          "",
          "## Deviations",
          "- Insufficient baseline",
          "",
          "## Unknowns",
          ...(signals.some((signal) => signal.timestamp === "Unknown")
            ? ["- Exact timestamp"]
            : []),
          "- Supporting context",
          "",
          "## Confidence Summary",
          "medium"
        ].join("\n")
      };
    }

    return {
      agent: this.name,
      schema: "intake",
      confidence: "medium",
      metadata: { providerText: providerResponse.text },
      output: [
        "## Signal Units",
        "",
        "### SU-001",
        "- Type: observation",
        "- Source: user",
        "- Timestamp: Unknown",
        `- Raw Input: ${rawInput}`,
        `- Observed Fact: ${fact}`,
        "- Inference: Unknown",
        "- Confidence: medium",
        "",
        "## Unknowns",
        "- Exact timestamp",
        "- Supporting context"
      ].join("\n")
    };
  }
}
