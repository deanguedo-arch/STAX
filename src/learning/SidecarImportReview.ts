import fs from "node:fs/promises";
import path from "node:path";
import { readTextIfExists } from "../sidecar/SidecarRepo.js";
import { PatternPromotionGate } from "./PatternPromotionGate.js";
import type { PatternPromotionDecision } from "./PatternPromotionSchemas.js";
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
  const gate = new PatternPromotionGate();
  return candidates
    .map((candidate) => {
      const patternDecision = patternPromotionDecisionForSidecarCandidate(candidate, gate);
      return [
        `Candidate: ${candidate.candidateId}`,
        `Source repo: ${candidate.sourceRepo.name}`,
        `Type: ${candidate.candidateType}`,
        `Scope: ${candidate.scope}`,
        `Status: ${candidate.status}`,
        `Sensitive data: ${candidate.privacy.redactionStatus}`,
        `Summary: ${candidate.summary}`,
        `Suggested artifact: ${candidate.proposedArtifact?.destinationHint ?? "none"}`,
        `Pattern classification: ${patternDecision.classification}`,
        `Pattern promotable: ${patternDecision.promotable ? "yes" : "no"}`,
        `Recommended queue: ${patternDecision.recommendedQueueType}`,
        `Promotion target: ${patternDecision.promotionTarget}`,
        `Pattern reason: ${patternDecision.reason}`,
        "Decision required: approve / reject / defer"
      ].join("\n");
    })
    .join("\n\n") + "\n";
}

export function patternPromotionDecisionForSidecarCandidate(
  candidate: SidecarImportCandidate,
  gate = new PatternPromotionGate()
): PatternPromotionDecision {
  return gate.classify({
    candidateId: candidate.candidateId,
    text: sidecarCandidatePatternText(candidate),
    sourceEventIds: [candidate.sourceEventId],
    repo: candidate.sourceRepo.name
  });
}

function sidecarCandidatePatternText(candidate: SidecarImportCandidate): string {
  const payloadText = candidate.proposedArtifact?.payload ? JSON.stringify(candidate.proposedArtifact.payload) : "";
  return [candidate.summary, payloadText].filter(Boolean).join("\n");
}
