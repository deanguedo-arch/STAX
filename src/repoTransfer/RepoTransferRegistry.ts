import { z } from "zod";
import archetypeFixture from "../../fixtures/repo_transfer/repo_archetypes.json" with { type: "json" };
import candidateFixture from "../../fixtures/repo_transfer/public_repo_candidates.json" with { type: "json" };

export const RepoArchetypeSchema = z.object({
  archetype: z.string().min(1),
  indicators: z.array(z.string().min(1)).min(1),
  proofGates: z.array(z.string().min(1)).min(1),
  dangerousActions: z.array(z.string().min(1)).min(1),
  likelyEnvironmentBlockers: z.array(z.string().min(1)).min(1),
  failurePatternsToTest: z.array(z.string().min(1)).min(1)
});

export const RepoCandidateSchema = z.object({
  repoFullName: z.string().min(1),
  archetype: z.string().min(1),
  whySelected: z.string().min(1),
  expectedProofGates: z.array(z.string().min(1)).min(1),
  highRiskPatterns: z.array(z.string().min(1)).min(1),
  fullLocalTestsLikelyTooExpensive: z.boolean(),
  recommendedFirstBoundedAuditTask: z.string().min(1)
});

type RepoArchetypeFile = { archetypes: z.infer<typeof RepoArchetypeSchema>[] };
type RepoCandidateFile = { candidates: z.infer<typeof RepoCandidateSchema>[] };

export type RepoArchetype = z.infer<typeof RepoArchetypeSchema>;
export type RepoCandidate = z.infer<typeof RepoCandidateSchema>;

export type RepoArchetypeGuidance = {
  archetype: string;
  label: string;
  indicators: string[];
  proofGates: string[];
  dangerousActions: string[];
  likelyEnvironmentBlockers: string[];
  failurePatternsToTest: string[];
  whySelected?: string;
  recommendedFirstBoundedAuditTask?: string;
  fullLocalTestsLikelyTooExpensive?: boolean;
  highRiskPatterns: string[];
};

const archetypes = z.object({ archetypes: z.array(RepoArchetypeSchema).min(1) }).parse(archetypeFixture as RepoArchetypeFile).archetypes;
const candidates = z.object({ candidates: z.array(RepoCandidateSchema).min(1) }).parse(candidateFixture as RepoCandidateFile).candidates;

const archetypeByName = new Map(archetypes.map((item) => [item.archetype, item]));
const candidateByRepo = new Map(candidates.map((item) => [item.repoFullName, item]));

export function listRepoArchetypes(): RepoArchetype[] {
  return [...archetypes];
}

export function listRepoCandidates(): RepoCandidate[] {
  return [...candidates];
}

export function findRepoArchetype(name: string | undefined): RepoArchetype | undefined {
  if (!name) return undefined;
  return archetypeByName.get(name);
}

export function findRepoCandidate(repoFullName: string | undefined): RepoCandidate | undefined {
  if (!repoFullName) return undefined;
  return candidateByRepo.get(repoFullName);
}

export function findRepoCandidateInText(text: string): RepoCandidate | undefined {
  const lower = text.toLowerCase();
  return candidates.find((candidate) => lower.includes(candidate.repoFullName.toLowerCase()));
}

export function findRepoArchetypeInText(text: string): RepoArchetype | undefined {
  const candidate = findRepoCandidateInText(text);
  if (candidate) return findRepoArchetype(candidate.archetype);
  return archetypes.find((entry) => text.includes(entry.archetype));
}

export function guidanceForRepoTransfer(input: {
  repoFullName?: string;
  archetypeName?: string;
}): RepoArchetypeGuidance | undefined {
  const candidate = findRepoCandidate(input.repoFullName);
  const archetype = findRepoArchetype(input.archetypeName ?? candidate?.archetype);
  if (!archetype) return undefined;

  return {
    archetype: archetype.archetype,
    label: humanizeArchetype(archetype.archetype),
    indicators: archetype.indicators,
    proofGates: candidate?.expectedProofGates ?? archetype.proofGates,
    dangerousActions: archetype.dangerousActions,
    likelyEnvironmentBlockers: archetype.likelyEnvironmentBlockers,
    failurePatternsToTest: archetype.failurePatternsToTest,
    whySelected: candidate?.whySelected,
    recommendedFirstBoundedAuditTask: candidate?.recommendedFirstBoundedAuditTask,
    fullLocalTestsLikelyTooExpensive: candidate?.fullLocalTestsLikelyTooExpensive,
    highRiskPatterns: candidate?.highRiskPatterns ?? archetype.failurePatternsToTest
  };
}

function humanizeArchetype(value: string): string {
  const wordMap: Record<string, string> = {
    js: "JavaScript",
    ui: "UI",
    e2e: "E2E",
    go: "Go",
    php: "PHP",
    python: "Python",
    rust: "Rust",
    ruby: "Ruby",
    ts: "TypeScript",
    typescript: "TypeScript"
  };

  return value
    .split("_")
    .map((segment) => {
      const mapped = wordMap[segment.toLowerCase()];
      if (mapped) return mapped;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" / ")
    .replace(" / Browser", " browser")
    .replace(" / Tooling", " tooling")
    .replace(" / Framework", " framework")
    .replace(" / Workspace", " workspace")
    .replace(" / System", " system")
    .replace(" / Pipeline", " pipeline")
    .replace(" / Integration", " integration");
}
