import { z } from "zod";

export const StrategyModeInputSchema = z.object({
  question: z.string().min(1),
  context: z.string().default(""),
  repoSpecific: z.boolean().default(false),
  evidenceAvailable: z.array(z.string()).default([])
});

export const StrategyModeResultSchema = z.object({
  strategyAnswer: z.string(),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedExperiment: z.string(),
  evidenceToCollect: z.array(z.string()),
  proofStatus: z.literal("reasoned_strategy_not_verified")
});

export type StrategyModeInput = z.input<typeof StrategyModeInputSchema>;
export type StrategyModeResult = z.infer<typeof StrategyModeResultSchema>;
