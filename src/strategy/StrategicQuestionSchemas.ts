import { z } from "zod";

export const StrategicValueLevelSchema = z.enum(["low", "medium", "high"]);
export const StrategicCostLevelSchema = z.enum(["low", "medium", "high"]);
export const StrategicReversibilitySchema = z.enum(["reversible", "costly_to_reverse", "hard_to_reverse"]);
export const StrategicConfidenceSchema = z.enum(["low", "medium", "high"]);
export const ProviderCapabilitySchema = z.enum(["limited_mock", "local_unknown", "reasoning_strong"]);

export const StrategicOptionSchema = z.object({
  optionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  userValue: StrategicValueLevelSchema,
  implementationCost: StrategicCostLevelSchema,
  reversibility: StrategicReversibilitySchema,
  opportunityCost: z.string().min(1),
  evidenceFor: z.array(z.string()).min(1),
  evidenceAgainst: z.array(z.string()).min(1),
  redTeamFailureModes: z.array(z.string()).min(1),
  proofNeeded: z.array(z.string()).min(1),
  killCriteria: z.array(z.string()).min(1)
});

export const StrategicDecisionSchema = z.object({
  question: z.string().min(1),
  optionsConsidered: z.array(StrategicOptionSchema).min(2),
  selectedOptionId: z.string().min(1),
  rationale: z.string().min(1),
  rejectedOptions: z.array(z.object({
    optionId: z.string().min(1),
    reasonRejected: z.string().min(1)
  })).min(1),
  decisionConfidence: StrategicConfidenceSchema,
  providerCapability: ProviderCapabilitySchema,
  evidenceUsed: z.array(z.string()),
  evidenceMissing: z.array(z.string()),
  nextProofStep: z.string().min(1),
  stopCondition: z.string().min(1)
});

export type StrategicOption = z.infer<typeof StrategicOptionSchema>;
export type StrategicDecision = z.infer<typeof StrategicDecisionSchema>;
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;
