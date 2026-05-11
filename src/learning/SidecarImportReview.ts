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
        `Recommended action: ${patternDecision.recommendedAction}`,
        `Promotion strength: ${patternDecision.strengthLabel} (${patternDecision.strengthScore}/10)`,
        `Pattern promotable: ${patternDecision.promotable ? "yes" : "no"}`,
        `Recommended queue: ${patternDecision.recommendedQueueType}`,
        `Promotion target: ${patternDecision.promotionTarget}`,
        `Boosters: ${patternDecision.boosters.length ? patternDecision.boosters.join(", ") : "none"}`,
        `Blockers: ${patternDecision.blockers.length ? patternDecision.blockers.join(", ") : "none"}`,
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
    repo: candidate.sourceRepo.name,
    codeChangeBacked: hasSubstantiveCodeChanges(candidate),
    testBacked: hasTestBacking(candidate),
    realRunBacked: hasRealRunBacking(candidate),
    reusableAcrossRepos: inferReusableAcrossRepos(candidate),
    repoScoped: candidate.scope === "repo",
    humanApproved: false
  });
}

function sidecarCandidatePatternText(candidate: SidecarImportCandidate): string {
  const payloadText = candidate.proposedArtifact?.payload ? JSON.stringify(candidate.proposedArtifact.payload) : "";
  return [candidate.summary, payloadText].filter(Boolean).join("\n");
}

function candidateSections(candidate: SidecarImportCandidate): Record<string, string> {
  const sections = candidate.proposedArtifact?.payload?.sections;
  if (!sections || typeof sections !== "object") return {};
  return Object.fromEntries(
    Object.entries(sections).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function hasSubstantiveCodeChanges(candidate: SidecarImportCandidate): boolean {
  const filesChanged = candidateSections(candidate).filesChanged ?? "";
  return /(src\/|tests\/|scripts\/|package\.json|package-lock\.json|AGENTS\.md|docs\/)/.test(filesChanged) && !onlySidecarFiles(filesChanged);
}

function onlySidecarFiles(filesChanged: string): boolean {
  const lines = filesChanged
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("-"));
  return lines.length > 0 && lines.every((line) => /\.stax\//.test(line));
}

function hasTestBacking(candidate: SidecarImportCandidate): boolean {
  const sections = candidateSections(candidate);
  const testsAdded = sections.testsAdded ?? "";
  const commandsRun = sections.commandsRun ?? "";
  const commandOutputSummary = sections.commandOutputSummary ?? "";
  return (
    (!/none\.?$/i.test(testsAdded.trim()) && /(test|spec)/i.test(testsAdded)) ||
    /(npm test|vitest|ingest:ci|typecheck|smoke:stax|rax -- eval)/i.test(commandsRun) ||
    /(tests? passed|passed \d+ files|passed \d+ tests|typecheck: pass|exit 0)/i.test(commandOutputSummary)
  );
}

function hasRealRunBacking(candidate: SidecarImportCandidate): boolean {
  const text = sidecarCandidatePatternText(candidate);
  return /(exit 0|generated|converted|preflight|accept|artifact|output|writes the expected artifact set|command evidence)/i.test(text);
}

function inferReusableAcrossRepos(candidate: SidecarImportCandidate): boolean {
  const text = sidecarCandidatePatternText(candidate).toLowerCase();
  if (candidate.candidateType === "validator_patch" || candidate.candidateType === "prompt_template") return true;
  if (/(must not|should include|requires|proof|schema|validator|contract|fake-complete|wrong repo|target repo|handoff)/.test(text)) {
    return true;
  }
  return hasSubstantiveCodeChanges(candidate) && !/(forensics|math 30|question bank|google form|microsoft forms|brightspace print quiz)/.test(text);
}
