import { z } from "zod";

export const JudgmentPacketInputSchema = z.object({
  decisionNeeded: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
  evidenceAvailable: z.array(z.string()).default([]),
  evidenceMissing: z.array(z.string()).default([]),
  riskIfApproved: z.string().default("Unknown until evidence is supplied."),
  riskIfRejected: z.string().default("Opportunity cost or delayed action."),
  irreversible: z.boolean().default(false),
  recommendedOption: z.string().optional()
});

export const JudgmentPacketSchema = z.object({
  decisionNeeded: z.string(),
  options: z.array(z.string()),
  recommendedOption: z.string(),
  why: z.string(),
  riskIfApproved: z.string(),
  riskIfRejected: z.string(),
  evidenceAvailable: z.array(z.string()),
  evidenceMissing: z.array(z.string()),
  irreversible: z.boolean(),
  requiresHumanApproval: z.literal(true)
});

export type JudgmentPacketInput = z.input<typeof JudgmentPacketInputSchema>;
export type JudgmentPacket = z.infer<typeof JudgmentPacketSchema>;
