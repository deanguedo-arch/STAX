import {
  JudgmentPacketInputSchema,
  JudgmentPacketSchema,
  type JudgmentPacket,
  type JudgmentPacketInput
} from "./JudgmentPacketSchemas.js";

export class JudgmentPacketBuilder {
  build(input: JudgmentPacketInput): JudgmentPacket {
    const parsed = JudgmentPacketInputSchema.parse(input);
    const recommendedOption = parsed.recommendedOption && parsed.options.includes(parsed.recommendedOption)
      ? parsed.recommendedOption
      : parsed.evidenceMissing.length
        ? optionContaining(parsed.options, "defer") ?? parsed.options[0]
        : parsed.options[0];
    return JudgmentPacketSchema.parse({
      decisionNeeded: parsed.decisionNeeded,
      options: parsed.options,
      recommendedOption,
      why: whyFor(recommendedOption, parsed.evidenceMissing),
      riskIfApproved: parsed.riskIfApproved,
      riskIfRejected: parsed.riskIfRejected,
      evidenceAvailable: parsed.evidenceAvailable,
      evidenceMissing: parsed.evidenceMissing,
      irreversible: parsed.irreversible,
      requiresHumanApproval: true
    });
  }
}

function optionContaining(options: string[], word: string): string | undefined {
  return options.find((item) => item.toLowerCase().includes(word));
}

function whyFor(recommendation: string, missing: string[]): string {
  if (missing.length) return `Recommend ${recommendation} until missing evidence is supplied: ${missing.join(", ")}.`;
  return `Recommend ${recommendation} based on supplied evidence; this packet does not execute the decision.`;
}
