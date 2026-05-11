import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso, sanitizeId } from "../sidecar/SidecarRepo.js";
import { PatternPromotionGate } from "./PatternPromotionGate.js";
import type { LearningQueueType } from "./LearningEvent.js";
import type {
  PatternPromotionAction,
  PatternPromotionClassification,
  PatternPromotionDecision,
  PatternPromotionTarget
} from "./PatternPromotionSchemas.js";
import { listSidecarImportCandidates, patternPromotionDecisionForSidecarCandidate } from "./SidecarImportReview.js";
import type { SidecarImportCandidate } from "./SidecarImportCandidate.js";

export type SidecarImportAggregate = {
  aggregateId: string;
  classification: PatternPromotionClassification;
  recommendedAction: PatternPromotionAction;
  candidateCount: number;
  sourceCandidateIds: string[];
  sourceEventIds: string[];
  sourceRepos: string[];
  exampleSummaries: string[];
  promotable: boolean;
  strengthScore: number;
  strengthLabel: PatternPromotionDecision["strengthLabel"];
  blockers: string[];
  boosters: string[];
  recommendedQueueType: LearningQueueType;
  promotionTarget: PatternPromotionTarget;
  reason: string;
  requiredEvidence: string[];
  expectedFutureBehaviorChange: string;
  suggestedRegressionEval?: string;
  requiresHumanApproval: true;
  autoPromote: false;
};

export type SidecarImportAggregationReport = {
  schemaVersion: "sidecar-import-aggregation-v1";
  generatedAt: string;
  pendingCandidateCount: number;
  aggregateCount: number;
  promotableAggregateCount: number;
  aggregates: SidecarImportAggregate[];
};

type ClassifiedCandidate = {
  candidate: SidecarImportCandidate;
  decision: PatternPromotionDecision;
};

export async function buildSidecarImportAggregationReport(staxRoot = process.cwd()): Promise<SidecarImportAggregationReport> {
  const candidates = await listSidecarImportCandidates(staxRoot);
  const aggregates = aggregateSidecarImportCandidates(candidates);
  return {
    schemaVersion: "sidecar-import-aggregation-v1",
    generatedAt: nowIso(),
    pendingCandidateCount: candidates.length,
    aggregateCount: aggregates.length,
    promotableAggregateCount: aggregates.filter((aggregate) => aggregate.promotable).length,
    aggregates
  };
}

export async function writeSidecarImportAggregationReport(staxRoot = process.cwd()): Promise<{
  report: SidecarImportAggregationReport;
  jsonPath: string;
  markdownPath: string;
}> {
  const report = await buildSidecarImportAggregationReport(staxRoot);
  const reportDir = path.join(staxRoot, "reports", "sidecar_learning");
  await ensureDirectory(reportDir);
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(reportDir, `sidecar-import-aggregation-${stamp}.json`);
  const markdownPath = path.join(reportDir, `sidecar-import-aggregation-${stamp}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, renderSidecarImportAggregation(report.aggregates, report), "utf8");
  return { report, jsonPath, markdownPath };
}

export function aggregateSidecarImportCandidates(candidates: SidecarImportCandidate[]): SidecarImportAggregate[] {
  const gate = new PatternPromotionGate();
  const classified = candidates
    .map((candidate) => ({
      candidate,
      decision: patternPromotionDecisionForSidecarCandidate(candidate, gate)
    }))
    .filter(({ candidate }) => candidate.status === "pending");

  const groups = new Map<PatternPromotionClassification, ClassifiedCandidate[]>();
  for (const item of classified) {
    const bucket = groups.get(item.decision.classification) ?? [];
    bucket.push(item);
    groups.set(item.decision.classification, bucket);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([classification, items]) => aggregateGroup(classification, items, gate));
}

export function renderSidecarImportAggregation(
  aggregates: SidecarImportAggregate[],
  report?: Pick<SidecarImportAggregationReport, "generatedAt" | "pendingCandidateCount" | "promotableAggregateCount">
): string {
  const lines = [
    "# Pending Aggregate Pattern Review",
    "",
    `Generated: ${report?.generatedAt ?? "not persisted"}`,
    `Pending candidates: ${report?.pendingCandidateCount ?? "unknown"}`,
    `Aggregate groups: ${aggregates.length}`,
    `Promotable aggregate groups: ${report?.promotableAggregateCount ?? aggregates.filter((aggregate) => aggregate.promotable).length}`,
    "",
    "No aggregate is accepted or promoted by this report. Requires human approval: yes.",
    ""
  ];

  for (const aggregate of aggregates) {
    lines.push(
      `## ${aggregate.aggregateId}`,
      "",
      `Classification: ${aggregate.classification}`,
      `Recommended action: ${aggregate.recommendedAction}`,
      `Candidate count: ${aggregate.candidateCount}`,
      `Promotion strength: ${aggregate.strengthLabel} (${aggregate.strengthScore}/10)`,
      `Promotable: ${aggregate.promotable ? "yes" : "no"}`,
      `Recommended queue: ${aggregate.recommendedQueueType}`,
      `Promotion target: ${aggregate.promotionTarget}`,
      "Requires human approval: yes",
      `Boosters: ${aggregate.boosters.length ? aggregate.boosters.join(", ") : "none"}`,
      `Blockers: ${aggregate.blockers.length ? aggregate.blockers.join(", ") : "none"}`,
      `Reason: ${aggregate.reason}`,
      `Expected behavior change: ${aggregate.expectedFutureBehaviorChange}`,
      aggregate.suggestedRegressionEval ? `Suggested regression eval: ${aggregate.suggestedRegressionEval}` : "Suggested regression eval: none",
      `Source candidates: ${aggregate.sourceCandidateIds.join(", ")}`,
      "",
      "Examples:",
      ...aggregate.exampleSummaries.map((summary) => `- ${summary}`),
      ""
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function aggregateGroup(
  classification: PatternPromotionClassification,
  items: ClassifiedCandidate[],
  gate: PatternPromotionGate
): SidecarImportAggregate {
  const sourceCandidateIds = items.map(({ candidate }) => candidate.candidateId);
  const sourceEventIds = items.map(({ candidate }) => candidate.sourceEventId);
  const sourceRepos = [...new Set(items.map(({ candidate }) => candidate.sourceRepo.name))].sort();
  const exampleSummaries = items.map(({ candidate }) => candidate.summary).slice(0, 5);
  const aggregateDecision = gate.classify({
    candidateId: `aggregate_${sanitizeId(classification)}`,
    text: aggregateTextFor(classification, items),
    sourceEventIds,
    repeatCount: items.length,
    severity: classification === "proof_boundary_rule" || classification === "policy_safety_rule" ? "major" : "minor"
  });

  return {
    aggregateId: `agg_${sanitizeId(classification)}`,
    classification,
    recommendedAction: aggregateDecision.recommendedAction,
    candidateCount: items.length,
    sourceCandidateIds,
    sourceEventIds,
    sourceRepos,
    exampleSummaries,
    promotable: aggregateDecision.promotable,
    strengthScore: aggregateDecision.strengthScore,
    strengthLabel: aggregateDecision.strengthLabel,
    blockers: aggregateDecision.blockers,
    boosters: aggregateDecision.boosters,
    recommendedQueueType: aggregateDecision.recommendedQueueType,
    promotionTarget: aggregateDecision.promotionTarget,
    reason: aggregateDecision.reason,
    requiredEvidence: aggregateDecision.requiredEvidence,
    expectedFutureBehaviorChange: aggregateDecision.expectedFutureBehaviorChange,
    suggestedRegressionEval: aggregateDecision.suggestedRegressionEval,
    requiresHumanApproval: true,
    autoPromote: false
  };
}

function aggregateTextFor(classification: PatternPromotionClassification, _items: ClassifiedCandidate[]): string {
  switch (classification) {
    case "codex_handoff_rule":
      return "Repeated Codex handoff prompt pattern: Codex handoff prompts should include repo path, files to inspect, exact commands, acceptance criteria, and stop condition.";
    case "proof_boundary_rule":
      return "Repeated proof boundary pattern: wrong repo command output, weak command output, unsupported claim, or Codex report lacking file list, diff, and command output must not verify target repo work.";
    case "schema_contract_rule":
      return "Repeated schema contract weakness: schema validation or validator contract should reject malformed output and not silently pass.";
    case "mode_behavior_rule":
      return "Repeated mode behavior rule: visual/layout or workflow mode completion requires rendered evidence and mode-specific proof.";
    case "policy_safety_rule":
      return "Repeated policy safety rule: publish, sync, deploy, push, or release requires preflight, target validation, and scope validation.";
    case "cross_repo_pattern":
      return "Repeated missing-specificity failures: Codex reports lacked file list, diff, command output, or bounded next action across repos.";
    case "user_preference":
      return "Repeated user preference candidates require explicit durable preference wording before memory promotion.";
    case "repo_specific_fact":
      return "Repo-specific facts such as package-lock changes, exact files, exact tests, or temporary repo state remain evidence, not durable learning.";
    case "trace_fact":
      return "Trace facts and one-off observations remain evidence until a reusable pattern is proven.";
  }
}
