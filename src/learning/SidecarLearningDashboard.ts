import fs from "node:fs/promises";
import path from "node:path";
import { readTextIfExists } from "../sidecar/SidecarRepo.js";
import { SidecarImportCandidateSchema, type SidecarImportCandidate } from "./SidecarImportCandidate.js";

export type SidecarLearningDashboard = {
  pending: number;
  promoted: number;
  rejected: number;
  falseAccepts: number;
  falseBlocks: number;
  usefulBlocks: number;
  repoMemoryCandidates: number;
  repeatedPatterns: Array<{ patternId: string; count: number }>;
  recommendedNextAction: string;
};

export async function buildSidecarLearningDashboard(staxRoot = process.cwd()): Promise<SidecarLearningDashboard> {
  const pending = await readCandidates(path.join(staxRoot, "queues", "sidecar_imports", "pending"));
  const promoted = await readCandidates(path.join(staxRoot, "queues", "sidecar_imports", "promoted"));
  const rejected = await readCandidates(path.join(staxRoot, "queues", "sidecar_imports", "rejected"));
  const all = [...pending, ...promoted, ...rejected];
  const patternCounts = new Map<string, number>();
  let falseAccepts = 0;
  let falseBlocks = 0;
  let usefulBlocks = 0;
  let repoMemoryCandidates = 0;

  for (const candidate of all) {
    const payload = candidate.proposedArtifact?.payload;
    const evidence = payload?.evidence as { failurePatternIds?: string[] } | undefined;
    const stax = payload?.stax as { falseAccept?: boolean; falseBlock?: boolean; usefulBlock?: boolean } | undefined;
    for (const pattern of evidence?.failurePatternIds ?? []) {
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
    }
    if (stax?.falseAccept) falseAccepts += 1;
    if (stax?.falseBlock) falseBlocks += 1;
    if (stax?.usefulBlock) usefulBlocks += 1;
    if (candidate.candidateType === "repo_memory") repoMemoryCandidates += 1;
  }

  const repeatedPatterns = [...patternCounts.entries()]
    .map(([patternId, count]) => ({ patternId, count }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count);

  return {
    pending: pending.length,
    promoted: promoted.length,
    rejected: rejected.length,
    falseAccepts,
    falseBlocks,
    usefulBlocks,
    repoMemoryCandidates,
    repeatedPatterns,
    recommendedNextAction:
      pending[0]?.candidateType === "none"
        ? "Review pending sidecar candidates and reject or defer non-promotable items."
        : pending[0]
          ? `Review ${pending[0].candidateId} for ${pending[0].candidateType} promotion.`
          : "No pending sidecar learning action."
  };
}

export function renderSidecarLearningDashboard(dashboard: SidecarLearningDashboard): string {
  return [
    "STAX Sidecar Learning Dashboard",
    "",
    `Pending candidates: ${dashboard.pending}`,
    `Promoted candidates: ${dashboard.promoted}`,
    `Rejected/deferred candidates: ${dashboard.rejected}`,
    "",
    `False accepts: ${dashboard.falseAccepts}`,
    `False blocks: ${dashboard.falseBlocks}`,
    `Useful blocks: ${dashboard.usefulBlocks}`,
    `Repo memory candidates: ${dashboard.repoMemoryCandidates}`,
    "",
    "Repeated patterns:",
    ...(dashboard.repeatedPatterns.length
      ? dashboard.repeatedPatterns.map((item) => `- ${item.patternId}: ${item.count}`)
      : ["- none"]),
    "",
    `Recommended next action: ${dashboard.recommendedNextAction}`
  ].join("\n") + "\n";
}

async function readCandidates(dir: string): Promise<SidecarImportCandidate[]> {
  const names = (await fs.readdir(dir).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const candidates: SidecarImportCandidate[] = [];
  for (const name of names) {
    const raw = await readTextIfExists(path.join(dir, name));
    if (!raw.trim()) continue;
    candidates.push(SidecarImportCandidateSchema.parse(JSON.parse(raw)));
  }
  return candidates;
}
