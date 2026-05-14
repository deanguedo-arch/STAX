import { printStaxStatus } from "./StaxGate.js";
import { readTextIfExists, sidecarDir, validateRepoPath } from "./SidecarRepo.js";

export async function getStaxStatus(repoPath: string): Promise<string> {
  const validatedRepoPath = await validateRepoPath(repoPath);
  const statusJson = await readStoredStatusSummary(validatedRepoPath);
  const status = await printStaxStatus(validatedRepoPath);
  const mode = statusJson ? "last-known status read" : "fresh audit generated because no stored status existed";
  const freshAudit = statusJson ? "no" : "yes, because no stored status existed";
  const generatedAt = statusJson?.generatedAt ? `- Stored Status Generated At: ${statusJson.generatedAt}` : "";
  return [
    "## STAX Status Read",
    "",
    `- Mode: ${mode}`,
    `- Fresh Audit: ${freshAudit}.`,
    "- To force a current audit, run `stax gate --repo <path>`.",
    generatedAt,
    "",
    status
  ].filter((line) => line !== "").join("\n");
}

async function readStoredStatusSummary(repoPath: string): Promise<{ generatedAt?: string } | undefined> {
  const raw = await readTextIfExists(`${sidecarDir(repoPath)}/status.json`);
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as { generatedAt?: unknown };
    return typeof parsed.generatedAt === "string" ? { generatedAt: parsed.generatedAt } : {};
  } catch {
    return {};
  }
}
