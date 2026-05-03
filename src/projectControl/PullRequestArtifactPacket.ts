import { z } from "zod";

export const PullRequestArtifactCiStatusSchema = z.object({
  workflow: z.string().min(1),
  status: z.enum(["success", "failure", "cancelled", "skipped", "pending", "unknown"]),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  finishedAt: z.string().datetime().optional(),
  summary: z.string().optional()
});

export const PullRequestArtifactReviewCommentSchema = z.object({
  author: z.string().min(1).optional(),
  path: z.string().optional(),
  body: z.string().min(1),
  state: z.enum(["open", "resolved", "unknown"]).default("unknown")
});

export const PullRequestArtifactIssueLinkSchema = z.object({
  issueId: z.string().min(1),
  title: z.string().optional(),
  status: z.enum(["open", "closed", "unknown"]).default("unknown")
});

export const PullRequestArtifactPacketSchema = z.object({
  prNumber: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().default(""),
  repo: z.string().optional(),
  branch: z.string().optional(),
  baseBranch: z.string().optional(),
  commitSha: z.string().optional(),
  changedFiles: z.array(z.string().min(1)).default([]),
  unifiedDiff: z.string().optional(),
  ciStatuses: z.array(PullRequestArtifactCiStatusSchema).default([]),
  reviewComments: z.array(PullRequestArtifactReviewCommentSchema).default([]),
  issueLinks: z.array(PullRequestArtifactIssueLinkSchema).default([]),
  labels: z.array(z.string()).default([])
});

export type PullRequestArtifactPacket = z.infer<typeof PullRequestArtifactPacketSchema>;
