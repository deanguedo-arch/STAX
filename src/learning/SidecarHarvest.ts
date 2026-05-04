import fs from "node:fs/promises";
import path from "node:path";
import { SidecarLearningEventSchema, type SidecarLearningEvent } from "../sidecar/SidecarLearningEvent.js";
import { ensureDirectory, nowIso, readTextIfExists, sanitizeId, sha256, shortHash, sidecarDir, validateRepoPath } from "../sidecar/SidecarRepo.js";
import type { SidecarImportCandidate } from "./SidecarImportCandidate.js";

export type SidecarHarvestResult = {
  sourceRepoPath: string;
  imported: number;
  skippedPrivacyBlocked: number;
  pendingDir: string;
  candidates: SidecarImportCandidate[];
};

export async function harvestSidecarEvents(options: {
  fromRepoPath: string;
  staxRoot?: string;
}): Promise<SidecarHarvestResult> {
  const sourceRepoPath = await validateRepoPath(options.fromRepoPath);
  const staxRoot = path.resolve(options.staxRoot ?? process.cwd());
  const eventsDir = path.join(sidecarDir(sourceRepoPath), "events");
  const pendingDir = path.join(staxRoot, "queues", "sidecar_imports", "pending");
  await ensureDirectory(pendingDir);
  const eventFiles = (await fs.readdir(eventsDir).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const candidates: SidecarImportCandidate[] = [];
  let skippedPrivacyBlocked = 0;

  for (const eventFile of eventFiles) {
    const raw = await readTextIfExists(path.join(eventsDir, eventFile));
    if (!raw.trim()) continue;
    const event = SidecarLearningEventSchema.parse(JSON.parse(raw));
    if (event.privacy.redactionStatus === "blocked") {
      skippedPrivacyBlocked += 1;
      continue;
    }
    const candidate = candidateFromEvent(event);
    const candidatePath = path.join(pendingDir, `${candidate.candidateId}.json`);
    await fs.writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    candidates.push(candidate);
  }

  return {
    sourceRepoPath,
    imported: candidates.length,
    skippedPrivacyBlocked,
    pendingDir,
    candidates
  };
}

export function candidateFromEvent(event: SidecarLearningEvent): SidecarImportCandidate {
  const candidateType = event.promotion.target;
  const candidateId = `cand_${sanitizeId(`${event.sourceRepo.name}_${event.eventId}_${shortHash(JSON.stringify(event.evidence))}`)}`;
  return {
    candidateId,
    sourceEventId: event.eventId,
    sourceRepo: event.sourceRepo,
    candidateType,
    scope: event.promotion.scope,
    summary: summarizeEvent(event),
    proposedArtifact:
      candidateType === "none"
        ? undefined
        : {
            destinationHint: destinationHintFor(candidateType),
            payload: {
              eventType: event.eventType,
              task: event.task,
              stax: event.stax,
              evidence: event.evidence,
              rationale: event.promotion.rationale
            }
          },
    requiresHumanApproval: true,
    status: "pending",
    privacy: event.privacy,
    createdAt: nowIso()
  };
}

function summarizeEvent(event: SidecarLearningEvent): string {
  const patterns = event.evidence.failurePatternIds.length
    ? ` Patterns: ${event.evidence.failurePatternIds.join(", ")}.`
    : "";
  return `${event.eventType} from ${event.sourceRepo.name}: ${event.task.finalOutcome || event.stax.verdict}.${patterns}`;
}

function destinationHintFor(candidateType: SidecarImportCandidate["candidateType"]): string {
  const base = {
    regression_eval: "evals/candidates/",
    redteam_eval: "evals/candidates/redteam/",
    failure_pattern: "fixtures/failure_patterns/candidates/",
    repo_archetype_rule: "fixtures/repo_transfer/archetype_candidates/",
    repo_memory: "memory/candidates/",
    validator_patch: "patches/candidates/",
    prompt_template: "prompts/candidates/",
    none: "queues/sidecar_imports/pending/"
  } satisfies Record<SidecarImportCandidate["candidateType"], string>;
  return base[candidateType];
}
