import fs from "node:fs/promises";
import path from "node:path";
import { readTextIfExists } from "../sidecar/SidecarRepo.js";
import { SidecarImportCandidateSchema, type SidecarImportCandidate } from "./SidecarImportCandidate.js";

export async function listSidecarImportCandidates(staxRoot = process.cwd()): Promise<SidecarImportCandidate[]> {
  const pendingDir = path.join(staxRoot, "queues", "sidecar_imports", "pending");
  const names = (await fs.readdir(pendingDir).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const candidates: SidecarImportCandidate[] = [];
  for (const name of names) {
    const raw = await readTextIfExists(path.join(pendingDir, name));
    if (!raw.trim()) continue;
    candidates.push(SidecarImportCandidateSchema.parse(JSON.parse(raw)));
  }
  return candidates;
}

export function renderSidecarImportReview(candidates: SidecarImportCandidate[]): string {
  if (candidates.length === 0) return "No pending sidecar import candidates.\n";
  return candidates
    .map((candidate) =>
      [
        `Candidate: ${candidate.candidateId}`,
        `Source repo: ${candidate.sourceRepo.name}`,
        `Type: ${candidate.candidateType}`,
        `Scope: ${candidate.scope}`,
        `Status: ${candidate.status}`,
        `Sensitive data: ${candidate.privacy.redactionStatus}`,
        `Summary: ${candidate.summary}`,
        `Suggested artifact: ${candidate.proposedArtifact?.destinationHint ?? "none"}`,
        "Decision required: approve / reject / defer"
      ].join("\n")
    )
    .join("\n\n") + "\n";
}
