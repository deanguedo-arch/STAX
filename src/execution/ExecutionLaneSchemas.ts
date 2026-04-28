import { z } from "zod";

export const ExecutionLaneStatusSchema = z.enum([
  "plan_only",
  "approval_required",
  "sandbox_created",
  "patch_applied_to_sandbox",
  "sandbox_commands_run",
  "sandbox_verified",
  "ready_for_human_apply",
  "rejected"
]);

export const ExecutionLaneInputSchema = z.object({
  requestedStatus: ExecutionLaneStatusSchema,
  humanApprovedSandbox: z.boolean().default(false),
  sandboxPath: z.string().optional(),
  patchAppliedToSandbox: z.boolean().default(false),
  commandExitCodes: z.array(z.number().int()).default([]),
  directLinkedRepoMutation: z.boolean().default(false),
  humanApprovedRealApply: z.boolean().default(false)
});

export const ExecutionLaneResultSchema = z.object({
  status: ExecutionLaneStatusSchema,
  allowed: z.boolean(),
  blockingReasons: z.array(z.string()),
  requiredNextApproval: z.string().optional(),
  summary: z.string()
});

export type ExecutionLaneInput = z.input<typeof ExecutionLaneInputSchema>;
export type ExecutionLaneResult = z.infer<typeof ExecutionLaneResultSchema>;
