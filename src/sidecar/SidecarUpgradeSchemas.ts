import { z } from "zod";

export const SidecarUpgradeResultSchema = z.object({
  repoPath: z.string().min(1),
  sidecarPath: z.string().min(1),
  targetProtocolVersion: z.string().min(1),
  changedFiles: z.array(z.string()).default([]),
  preservedFiles: z.array(z.string()).default([]),
  agentsPath: z.string().min(1),
  configPath: z.string().min(1),
  protocolPath: z.string().min(1),
  promptContractPath: z.string().min(1),
  proofSurfaceCandidatePath: z.string().optional(),
  proofSurfaceReviewPath: z.string().optional()
});

export type SidecarUpgradeResult = z.infer<typeof SidecarUpgradeResultSchema>;
