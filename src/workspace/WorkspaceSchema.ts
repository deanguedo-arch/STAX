import { z } from "zod";

export const WorkspaceNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._-]+$/, "Workspace names may only contain letters, numbers, dots, underscores, and hyphens.");

export const WorkspaceSchema = z.object({
  workspace: WorkspaceNameSchema,
  repoPath: z.string().min(1).optional(),
  repoPathOriginal: z.string().min(1).optional(),
  repoPathResolved: z.string().min(1).optional(),
  defaultMode: z.literal("project_brain"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approved: z.literal(true),
  tags: z.array(z.string())
});

export const WorkspaceRegistryRecordSchema = z.object({
  name: WorkspaceNameSchema,
  repo: z.string().optional(),
  repoPath: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const WorkspaceRegistryFileSchema = z.object({
  current: WorkspaceNameSchema.optional(),
  workspaces: z.array(WorkspaceRegistryRecordSchema)
});

export const WORKSPACE_DOC_FILES = [
  "PROJECT_STATE.md",
  "DECISION_LOG.md",
  "KNOWN_FAILURES.md",
  "NEXT_ACTIONS.md",
  "EVIDENCE_REGISTRY.md",
  "CLAIM_LEDGER.md"
] as const;

export const WORKSPACE_DIRS = [
  "evals",
  "goldens",
  "corrections",
  "lab"
] as const;

export type WorkspaceRecordV2 = z.infer<typeof WorkspaceSchema>;
export type WorkspaceRegistryRecordV2 = z.infer<typeof WorkspaceRegistryRecordSchema>;
export type WorkspaceRegistryFileV2 = z.infer<typeof WorkspaceRegistryFileSchema>;
