import { z } from "zod";

export const SidecarImportCandidateSchema = z.object({
  candidateId: z.string().min(1),
  sourceEventId: z.string().min(1),
  sourceRepo: z.object({
    name: z.string().min(1),
    pathHash: z.string().min(8),
    branch: z.string().optional(),
    commitSha: z.string().optional()
  }),
  candidateType: z.enum([
    "regression_eval",
    "redteam_eval",
    "failure_pattern",
    "repo_archetype_rule",
    "repo_memory",
    "validator_patch",
    "prompt_template",
    "none"
  ]),
  scope: z.enum(["global", "repo", "archetype", "none"]),
  summary: z.string().min(1),
  proposedArtifact: z
    .object({
      destinationHint: z.string(),
      payload: z.record(z.string(), z.unknown())
    })
    .optional(),
  requiresHumanApproval: z.literal(true),
  status: z.enum(["pending", "promoted", "rejected", "deferred"]),
  privacy: z.object({
    redactionStatus: z.enum(["clean", "redacted", "blocked"]),
    redactionNotes: z.array(z.string()).default([])
  }),
  createdAt: z.string().datetime(),
  promotedAt: z.string().datetime().optional()
});

export type SidecarImportCandidate = z.infer<typeof SidecarImportCandidateSchema>;
