import { z } from "zod";

export const RepoProofSurfaceSchema = z.object({
  repoId: z.enum(["admission_app", "canvas_helper", "brightspacequizexporter"]),
  aliases: z.array(z.string()).min(1),
  repoPath: z.string(),
  commands: z.record(z.string(), z.string()),
  files: z.record(z.string(), z.string()),
  blockedLiveActions: z.array(z.string()).default([]),
  proofArtifacts: z.array(z.string()).default([]),
  stopConditions: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

export const RepoProofSurfaceRegistrySchema = z.array(RepoProofSurfaceSchema).min(1);

export type RepoProofSurface = z.infer<typeof RepoProofSurfaceSchema>;
export type RepoProofSurfaceId = RepoProofSurface["repoId"];
