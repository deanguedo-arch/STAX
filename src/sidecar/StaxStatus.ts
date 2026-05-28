import { printStaxStatus } from "./StaxGate.js";
import { collectGitSnapshot, readTextIfExists, sidecarDir, validateRepoPath } from "./SidecarRepo.js";

type StoredStatusSummary = {
  generatedAt?: string;
  branch?: string;
  commitSha?: string;
};

export async function getStaxStatus(repoPath: string): Promise<string> {
  const validatedRepoPath = await validateRepoPath(repoPath);
  const statusJson = await readStoredStatusSummary(validatedRepoPath);
  const snapshot = await collectGitSnapshot(validatedRepoPath);
  const status = await printStaxStatus(validatedRepoPath);
  const mode = statusJson ? "last-known status read" : "fresh audit generated because no stored status existed";
  const freshAudit = statusJson ? "no" : "yes, because no stored status existed";
  const generatedAt = statusJson?.generatedAt ? `- Stored Status Generated At: ${statusJson.generatedAt}` : "";
  const freshness = statusJson ? statusFreshnessSummary(statusJson, snapshot) : "- Status Freshness: fresh audit generated.";
  return [
    "## STAX Status Read",
    "",
    `- Mode: ${mode}`,
    `- Fresh Audit: ${freshAudit}.`,
    "- Scope: this command reads stored sidecar status unless no status exists; it is not proof of current repo state after later changes.",
    freshness,
    generatedAt,
    snapshot.branch ? `- Current Branch: ${snapshot.branch}` : "",
    snapshot.commitSha ? `- Current Commit: ${snapshot.commitSha}` : "",
    "- To force a current audit, run `stax gate --repo <path>`.",
    "",
    status
  ].filter((line) => line !== "").join("\n");
}

async function readStoredStatusSummary(repoPath: string): Promise<StoredStatusSummary | undefined> {
  const raw = await readTextIfExists(`${sidecarDir(repoPath)}/status.json`);
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as { generatedAt?: unknown; branch?: unknown; commitSha?: unknown };
    const config = await readSidecarConfigSummary(repoPath);
    return {
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      branch: typeof parsed.branch === "string" ? parsed.branch : config.branch,
      commitSha: typeof parsed.commitSha === "string" ? parsed.commitSha : config.commitSha
    };
  } catch {
    return {};
  }
}

async function readSidecarConfigSummary(repoPath: string): Promise<Pick<StoredStatusSummary, "branch" | "commitSha">> {
  const raw = await readTextIfExists(`${sidecarDir(repoPath)}/config.json`);
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as { branch?: unknown; commitSha?: unknown };
    return {
      branch: typeof parsed.branch === "string" ? parsed.branch : undefined,
      commitSha: typeof parsed.commitSha === "string" ? parsed.commitSha : undefined
    };
  } catch {
    return {};
  }
}

function statusFreshnessSummary(
  stored: StoredStatusSummary,
  snapshot: { branch?: string; commitSha?: string; gitStatusShort: string }
): string {
  const storedCommit = stored.commitSha;
  const currentCommit = snapshot.commitSha;
  if (storedCommit && currentCommit && storedCommit !== currentCommit) {
    return `- Status Freshness: stale; stored commit ${storedCommit.slice(0, 12)} does not match current commit ${currentCommit.slice(0, 12)}. Run \`stax gate --repo <path>\`.`;
  }
  if (stored.branch && snapshot.branch && stored.branch !== snapshot.branch) {
    return `- Status Freshness: stale; stored branch ${stored.branch} does not match current branch ${snapshot.branch}. Run \`stax gate --repo <path>\`.`;
  }
  if (snapshot.gitStatusShort.trim()) {
    return "- Status Freshness: possibly stale; current worktree has uncommitted changes and this status read does not prove they were audited. Run `stax gate --repo <path>` after edits.";
  }
  return "- Status Freshness: current for stored commit and clean worktree.";
}
