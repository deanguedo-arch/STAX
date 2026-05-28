import fs from "node:fs/promises";
import path from "node:path";
import { readTextIfExists } from "../sidecar/SidecarRepo.js";
import { aggregateSidecarImportCandidates, type SidecarImportAggregate } from "./SidecarImportAggregation.js";
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
  aggregateGroups: number;
  promotableAggregateGroups: number;
  reviewedAggregateGroups: number;
  topAggregateRecommendation?: {
    aggregateId: string;
    classification: SidecarImportAggregate["classification"];
    candidateCount: number;
    promotionTarget: SidecarImportAggregate["promotionTarget"];
    recommendedQueueType: SidecarImportAggregate["recommendedQueueType"];
    strengthLabel: SidecarImportAggregate["strengthLabel"];
    suggestedRegressionEval?: string;
  };
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
  const aggregates = aggregateSidecarImportCandidates(pending);
  const promotableAggregates = aggregates.filter((aggregate) => aggregate.promotable);
  const reviewedAggregateIds = await findReviewedAggregateIds(staxRoot, promotableAggregates);
  const unreviewedPromotableAggregates = promotableAggregates.filter(
    (aggregate) => !reviewedAggregateIds.has(aggregate.aggregateId)
  );
  const topAggregate = chooseTopAggregateRecommendation(unreviewedPromotableAggregates);

  return {
    pending: pending.length,
    promoted: promoted.length,
    rejected: rejected.length,
    falseAccepts,
    falseBlocks,
    usefulBlocks,
    repoMemoryCandidates,
    repeatedPatterns,
    aggregateGroups: aggregates.length,
    promotableAggregateGroups: promotableAggregates.length,
    reviewedAggregateGroups: reviewedAggregateIds.size,
    topAggregateRecommendation: topAggregate
      ? {
          aggregateId: topAggregate.aggregateId,
          classification: topAggregate.classification,
          candidateCount: topAggregate.candidateCount,
          promotionTarget: topAggregate.promotionTarget,
          recommendedQueueType: topAggregate.recommendedQueueType,
          strengthLabel: topAggregate.strengthLabel,
          suggestedRegressionEval: topAggregate.suggestedRegressionEval
        }
      : undefined,
    recommendedNextAction: topAggregate
      ? `Review aggregate ${topAggregate.aggregateId} (${topAggregate.classification}, ${topAggregate.candidateCount} candidates) for ${topAggregate.promotionTarget}; add or confirm the regression eval before promotion.`
      : reviewedAggregateIds.size > 0 && promotableAggregates.length === reviewedAggregateIds.size
        ? "All promotable aggregate groups have reviewed promotion artifacts; review raw pending candidates or close/defer non-promotable items."
        : pending[0]?.candidateType === "none"
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
    `Aggregate groups: ${dashboard.aggregateGroups}`,
    `Promotable aggregate groups: ${dashboard.promotableAggregateGroups}`,
    `Reviewed aggregate groups: ${dashboard.reviewedAggregateGroups}`,
    "Top aggregate recommendation:",
    ...(dashboard.topAggregateRecommendation
      ? [
          `- ${dashboard.topAggregateRecommendation.aggregateId}: ${dashboard.topAggregateRecommendation.classification}`,
          `- candidates: ${dashboard.topAggregateRecommendation.candidateCount}`,
          `- target: ${dashboard.topAggregateRecommendation.promotionTarget}`,
          `- queue: ${dashboard.topAggregateRecommendation.recommendedQueueType}`,
          `- strength: ${dashboard.topAggregateRecommendation.strengthLabel}`,
          `- regression: ${dashboard.topAggregateRecommendation.suggestedRegressionEval ?? "none"}`
        ]
      : ["- none"]),
    "",
    `Recommended next action: ${dashboard.recommendedNextAction}`
  ].join("\n") + "\n";
}

async function findReviewedAggregateIds(
  staxRoot: string,
  aggregates: SidecarImportAggregate[]
): Promise<Set<string>> {
  const reviewed = new Set<string>();
  await Promise.all(
    aggregates.map(async (aggregate) => {
      const artifactPath = aggregatePromotionArtifactPath(staxRoot, aggregate);
      if (!artifactPath) return;
      const raw = await readTextIfExists(artifactPath);
      if (!raw.trim()) return;
      try {
        const parsed = JSON.parse(raw) as { aggregateId?: string; status?: string };
        if (parsed.aggregateId === aggregate.aggregateId && parsed.status) {
          reviewed.add(aggregate.aggregateId);
        }
      } catch {
        // Ignore malformed review artifacts here; promotion validation owns their schema.
      }
    })
  );
  return reviewed;
}

function aggregatePromotionArtifactPath(
  staxRoot: string,
  aggregate: SidecarImportAggregate
): string | undefined {
  const relativeDir = aggregatePromotionDirectory(aggregate.promotionTarget);
  return relativeDir ? path.join(staxRoot, relativeDir, `${aggregate.aggregateId}.json`) : undefined;
}

function aggregatePromotionDirectory(target: SidecarImportAggregate["promotionTarget"]): string | undefined {
  switch (target) {
    case "eval":
      return path.join("evals", "candidates");
    case "mode_contract_patch":
      return path.join("learning", "proposals", "mode_contract_patch_candidates");
    case "policy_patch":
      return path.join("learning", "proposals", "policy_patch_candidates");
    case "schema_patch":
      return path.join("learning", "proposals", "schema_patch_candidates");
    case "memory":
      return path.join("memory", "candidates");
    case "correction":
      return path.join("learning", "proposals", "correction_candidates");
    case "training":
      return path.join("learning", "proposals", "training_candidates");
    case "golden":
      return path.join("learning", "proposals", "golden_candidates");
    case "none":
      return undefined;
  }
}

function chooseTopAggregateRecommendation(aggregates: SidecarImportAggregate[]): SidecarImportAggregate | undefined {
  const priority: Record<SidecarImportAggregate["classification"], number> = {
    mode_behavior_rule: 0,
    proof_boundary_rule: 1,
    policy_safety_rule: 2,
    schema_contract_rule: 3,
    codex_handoff_rule: 4,
    cross_repo_pattern: 5,
    user_preference: 6,
    repo_specific_fact: 7,
    trace_fact: 8
  };
  return [...aggregates].sort((left, right) => {
    const priorityDelta = priority[left.classification] - priority[right.classification];
    if (priorityDelta !== 0) return priorityDelta;
    const strengthDelta = right.strengthScore - left.strengthScore;
    if (strengthDelta !== 0) return strengthDelta;
    return right.candidateCount - left.candidateCount;
  })[0];
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
