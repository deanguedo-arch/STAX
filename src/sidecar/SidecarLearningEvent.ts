import { z } from "zod";

export const SidecarLearningEventTypeSchema = z.enum([
  "fake_complete_caught",
  "missing_proof_caught",
  "wrong_repo_prevented",
  "wrong_branch_prevented",
  "weak_proof_blocked",
  "unsafe_publish_blocked",
  "verified_accept",
  "useful_next_action",
  "false_accept",
  "false_block",
  "generic_next_action",
  "user_rejected_stax",
  "eval_candidate",
  "failure_pattern_candidate",
  "repo_memory_candidate",
  "command_evidence_collected"
]);

export const SidecarLearningEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: SidecarLearningEventTypeSchema,
  schemaVersion: z.literal("sidecar-learning-v1"),
  createdAt: z.string().datetime(),
  sourceRepo: z.object({
    name: z.string().min(1),
    pathHash: z.string().min(8),
    archetype: z.string().optional(),
    commitSha: z.string().optional(),
    branch: z.string().optional()
  }),
  task: z.object({
    taskId: z.string().min(1),
    objective: z.string().default(""),
    finalOutcome: z.string().default("")
  }),
  stax: z.object({
    verdict: z.string().min(1),
    useful: z.boolean(),
    falseAccept: z.boolean(),
    falseBlock: z.boolean(),
    usefulBlock: z.boolean(),
    verifiedAccept: z.boolean()
  }),
  evidence: z.object({
    changedFileRoles: z.array(z.string()).default([]),
    commandProofStrengths: z.array(z.string()).default([]),
    claimTypes: z.array(z.string()).default([]),
    failurePatternIds: z.array(z.string()).default([])
  }),
  human: z
    .object({
      decision: z.string().optional(),
      reason: z.string().optional(),
      cleanupPromptsAfterCodex: z.number().int().nonnegative().optional()
    })
    .optional(),
  promotion: z.object({
    suggested: z.boolean(),
    target: z
      .enum([
        "regression_eval",
        "redteam_eval",
        "failure_pattern",
        "repo_archetype_rule",
        "repo_memory",
        "validator_patch",
        "prompt_template",
        "none"
      ])
      .default("none"),
    scope: z.enum(["global", "repo", "archetype", "none"]).default("none"),
    rationale: z.string().default("")
  }),
  privacy: z.object({
    redactionStatus: z.enum(["clean", "redacted", "blocked"]),
    redactionNotes: z.array(z.string()).default([])
  })
});

export type SidecarLearningEventType = z.infer<typeof SidecarLearningEventTypeSchema>;
export type SidecarLearningEvent = z.infer<typeof SidecarLearningEventSchema>;
