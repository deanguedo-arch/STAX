import type { RepoDiscoveryResult } from "./RepoDiscoverySchemas.js";

export function detectStacks(discovery: RepoDiscoveryResult): string[] {
  const haystack = [
    ...discovery.files.map((file) => file.path),
    ...discovery.packageScripts.flatMap((script) => [script.name, script.command])
  ].join("\n").toLowerCase();
  const stacks = new Set<string>();
  if (discovery.files.some((file) => file.path === "package.json")) stacks.add("node");
  if (/vite|vite\.config/.test(haystack)) stacks.add("vite");
  if (/playwright|playwright\.config/.test(haystack)) stacks.add("playwright");
  if (/cypress/.test(haystack)) stacks.add("cypress");
  if (/storybook/.test(haystack)) stacks.add("storybook");
  if (/next|next\.config/.test(haystack)) stacks.add("next");
  if (/pyproject|requirements\.txt|\.py\b/.test(haystack)) stacks.add("python");
  if (/\.html|\.css|workspace|course-shell|canvas/.test(haystack)) stacks.add("html-css");
  return [...stacks].sort();
}
