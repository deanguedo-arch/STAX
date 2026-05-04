import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso, readTextIfExists, sanitizeId } from "../sidecar/SidecarRepo.js";
import { SidecarImportCandidateSchema, type SidecarImportCandidate } from "./SidecarImportCandidate.js";

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

  const artifactDir = path.join(staxRoot, destinationDir(candidate.candidateType));
  await ensureDirectory(artifactDir);
  const artifactPath = path.join(artifactDir, `${sanitizeId(candidate.candidateId)}.json`);
  await fs.writeFile(
    artifactPath,
    `${JSON.stringify(
      {
        schemaVersion: "sidecar-promoted-candidate-v1",
        promotedAt: nowIso(),
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

function destinationDir(candidateType: SidecarImportCandidate["candidateType"]): string {
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
