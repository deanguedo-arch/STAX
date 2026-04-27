import { z } from "zod";

export const RepoSkippedPathSchema = z.object({
  path: z.string(),
  reason: z.string()
});

export const RepoRedactionSchema = z.object({
  path: z.string(),
  count: z.number().int().nonnegative(),
  reason: z.string()
});

export const RepoEvidenceSnippetSchema = z.object({
  path: z.string(),
  excerpt: z.string()
});

export const RepoScriptSchema = z.object({
  name: z.string(),
  command: z.string()
});

export const RepoEvidencePackSchema = z.object({
  repoPath: z.string(),
  workspace: z.string().optional(),
  workspaceResolution: z.enum(["named_workspace", "active_workspace", "current_repo"]),
  createdAt: z.string().datetime(),
  gitStatus: z.string().optional(),
  inspectedFiles: z.array(z.string()),
  importantFiles: z.array(z.string()),
  configFiles: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  testFiles: z.array(z.string()),
  docsFiles: z.array(z.string()),
  operationalFiles: z.array(z.string()).default([]),
  scripts: z.array(RepoScriptSchema),
  missingExpectedFiles: z.array(z.string()),
  riskFlags: z.array(z.string()),
  skippedPaths: z.array(RepoSkippedPathSchema),
  redactions: z.array(RepoRedactionSchema),
  snippets: z.array(RepoEvidenceSnippetSchema),
  markdown: z.string()
});

export type RepoSkippedPath = z.infer<typeof RepoSkippedPathSchema>;
export type RepoRedaction = z.infer<typeof RepoRedactionSchema>;
export type RepoEvidenceSnippet = z.infer<typeof RepoEvidenceSnippetSchema>;
export type RepoScript = z.infer<typeof RepoScriptSchema>;
export type RepoEvidencePack = z.infer<typeof RepoEvidencePackSchema>;
