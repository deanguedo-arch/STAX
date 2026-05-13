import { z } from "zod";

export const RepoDiscoveredFileSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["package_json", "lockfile", "workflow", "script", "tool", "doc", "config", "example_config", "other"]),
  sizeBytes: z.number().int().nonnegative().optional(),
  redacted: z.boolean().default(false)
});

export const RepoPackageScriptSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  source: z.literal("package.json")
});

export const RepoDiscoveryResultSchema = z.object({
  schemaVersion: z.literal("stax-repo-discovery-v1"),
  repoPath: z.string().min(1),
  repoName: z.string().min(1),
  packageScripts: z.array(RepoPackageScriptSchema).default([]),
  files: z.array(RepoDiscoveredFileSchema).default([]),
  warnings: z.array(z.string().min(1)).default([])
});

export type RepoDiscoveredFile = z.infer<typeof RepoDiscoveredFileSchema>;
export type RepoPackageScript = z.infer<typeof RepoPackageScriptSchema>;
export type RepoDiscoveryResult = z.infer<typeof RepoDiscoveryResultSchema>;
