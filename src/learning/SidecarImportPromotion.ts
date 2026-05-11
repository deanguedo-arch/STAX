import fs from "node:fs/promises";
import path from "node:path";
import { PatternPromotionGate } from "./PatternPromotionGate.js";
import { patternPromotionDecisionForSidecarCandidate } from "./SidecarImportReview.js";
import { ensureDirectory, nowIso, readTextIfExists, sanitizeId } from "../sidecar/SidecarRepo.js";
import { SidecarImportCandidateSchema, type SidecarImportCandidate } from "./SidecarImportCandidate.js";
import type { PatternPromotionTarget } from "./PatternPromotionSchemas.js";

export type PromoteSidecarImportOptions = {
  candidateId: string;
  approve: boolean;
  allowSingleEvent?: boolean;
  staxRoot?: string;
};

export type PromoteSidecarImportResult = {
  candidate: SidecarImportCandidate;
  artifactPath: string;
  promotedPath: string;
};

export async function promoteSidecarImport(options: PromoteSidecarImportOptions): Promise<PromoteSidecarImportResult> {
  if (!options.approve) throw new Error("Promotion requires --approve.");
  const staxRoot = path.resolve(options.staxRoot ?? process.cwd());
  const pendingPath = path.join(staxRoot, "queues", "sidecar_imports", "pending", `${options.candidateId}.json`);
  const raw = await readTextIfExists(pendingPath);
  if (!raw.trim()) throw new Error(`Pending candidate not found: ${options.candidateId}`);
  const candidate = SidecarImportCandidateSchema.parse(JSON.parse(raw));
  if (candidate.privacy.redactionStatus === "blocked") throw new Error("Privacy-blocked candidate cannot be promoted.");
  if (candidate.candidateType === "failure_pattern" && candidate.scope === "global" && !options.allowSingleEvent) {
    throw new Error("Global failure-pattern promotion from a single event requires --allow-single-event.");
  }
  if (candidate.candidateType === "none") throw new Error("Candidate type 'none' has no promotion target.");
  const decision = patternPromotionDecisionForSidecarCandidate(candidate, new PatternPromotionGate());
  if (decision.recommendedAction === "discard") throw new Error("Discard-only candidate cannot be promoted.");
  const effectiveTarget = decision.promotionTarget !== "none" ? decision.promotionTarget : fallbackPromotionTarget(candidate.candidateType);
  if (effectiveTarget === "none") throw new Error("Candidate review did not produce a durable promotion target.");

  const artifactDir = path.join(staxRoot, destinationDir(effectiveTarget, candidate.candidateType));
  await ensureDirectory(artifactDir);
  const artifactPath = path.join(artifactDir, `${sanitizeId(candidate.candidateId)}.json`);
  await fs.writeFile(
    artifactPath,
    `${JSON.stringify(
      {
        schemaVersion: "sidecar-promoted-candidate-v1",
        promotedAt: nowIso(),
        decision,
        candidate
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const promoted = {
    ...candidate,
    status: "promoted" as const,
    promotedAt: nowIso()
  };
  const promotedDir = path.join(staxRoot, "queues", "sidecar_imports", "promoted");
  await ensureDirectory(promotedDir);
  const promotedPath = path.join(promotedDir, `${candidate.candidateId}.json`);
  await fs.writeFile(promotedPath, `${JSON.stringify(promoted, null, 2)}\n`, "utf8");
  await fs.rm(pendingPath);
  await appendPromotionLog(staxRoot, promoted, artifactPath);

  return {
    candidate: promoted,
    artifactPath,
    promotedPath
  };
}

function destinationDir(
  promotionTarget: PatternPromotionTarget,
  candidateType: SidecarImportCandidate["candidateType"]
): string {
  switch (promotionTarget) {
    case "eval":
      return candidateType === "redteam_eval" ? "evals/candidates/redteam" : "evals/candidates";
    case "schema_patch":
      return "learning/proposals/schema_patch_candidates";
    case "mode_contract_patch":
      return "learning/proposals/mode_contract_patch_candidates";
    case "policy_patch":
      return "learning/proposals/policy_patch_candidates";
    case "memory":
      return "memory/candidates";
    case "correction":
      return "learning/proposals/correction_candidates";
    case "training":
      return "learning/proposals/training_candidates";
    case "golden":
      return "learning/proposals/golden_candidates";
    case "none":
      return destinationDirFromCandidateType(candidateType);
  }
}

function fallbackPromotionTarget(candidateType: SidecarImportCandidate["candidateType"]): PatternPromotionTarget {
  switch (candidateType) {
    case "regression_eval":
    case "redteam_eval":
      return "eval";
    case "failure_pattern":
      return "golden";
    case "repo_archetype_rule":
      return "golden";
    case "repo_memory":
      return "memory";
    case "validator_patch":
      return "schema_patch";
    case "prompt_template":
      return "mode_contract_patch";
    case "none":
      return "none";
  }
}

function destinationDirFromCandidateType(candidateType: SidecarImportCandidate["candidateType"]): string {
  switch (candidateType) {
    case "regression_eval":
      return "evals/candidates";
    case "redteam_eval":
      return "evals/candidates/redteam";
    case "failure_pattern":
      return "fixtures/failure_patterns/candidates";
    case "repo_archetype_rule":
      return "fixtures/repo_transfer/archetype_candidates";
    case "repo_memory":
      return "memory/candidates";
    case "validator_patch":
      return "patches/candidates";
    case "prompt_template":
      return "prompts/candidates";
    case "none":
      return "queues/sidecar_imports/promoted";
  }
}

async function appendPromotionLog(staxRoot: string, candidate: SidecarImportCandidate, artifactPath: string): Promise<void> {
  const logDir = path.join(staxRoot, "reports", "sidecar_learning");
  await ensureDirectory(logDir);
  const logPath = path.join(logDir, "promotion_log.jsonl");
  await fs.appendFile(
    logPath,
    `${JSON.stringify({ promotedAt: candidate.promotedAt, candidateId: candidate.candidateId, artifactPath })}\n`,
    "utf8"
  );
}
