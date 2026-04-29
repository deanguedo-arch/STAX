import { z } from "zod";

export const CapabilityRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const CapabilityContextSchema = z.enum([
  "read_only",
  "local_stax",
  "sandbox",
  "linked_repo",
  "durable_state",
  "external_service"
]);

export const CapabilityDeclarationSchema = z.object({
  capabilityId: z.string().min(1),
  description: z.string().min(1),
  riskLevel: CapabilityRiskLevelSchema,
  allowedContexts: z.array(CapabilityContextSchema),
  requiresApproval: z.boolean(),
  artifactRequired: z.boolean(),
  rollbackRequired: z.boolean(),
  enabledByDefault: z.boolean()
});

export const CapabilityDecisionSchema = z.object({
  allowed: z.boolean(),
  capabilityId: z.string(),
  reason: z.string(),
  requiresApproval: z.boolean(),
  artifactRequired: z.boolean(),
  rollbackRequired: z.boolean()
});

export type CapabilityRiskLevel = z.infer<typeof CapabilityRiskLevelSchema>;
export type CapabilityContext = z.infer<typeof CapabilityContextSchema>;
export type CapabilityDeclaration = z.infer<typeof CapabilityDeclarationSchema>;
export type CapabilityDecision = z.infer<typeof CapabilityDecisionSchema>;
