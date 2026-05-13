import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso, readTextIfExists, sidecarDir, validateRepoPath } from "../sidecar/SidecarRepo.js";
import { detectCommandSurfaces } from "./CommandSurfaceDetector.js";
import { generateProofSurfaceCandidate } from "./ProofSurfaceCandidateGenerator.js";
import { ProofSurfacePackSchema, type ProofSurfacePack } from "./ProofSurfacePackSchemas.js";
import { discoverRepo } from "./RepoDiscovery.js";
import { detectRiskSurfaces } from "./RiskSurfaceDetector.js";
import { detectStacks } from "./StackDetector.js";
import { renderProofSurfaceReviewPacket } from "./ProofSurfaceReviewPacket.js";

export type ProofSurfaceDiscoveryResult = {
  repoPath: string;
  candidatePath: string;
  reviewPath: string;
  pack: ProofSurfacePack;
};

export async function discoverProofSurfaces(repoPathInput: string): Promise<ProofSurfaceDiscoveryResult> {
  const repoPath = await validateRepoPath(repoPathInput);
  const discovery = await discoverRepo(repoPath);
  const detectedStack = detectStacks(discovery);
  const commandSurfaces = detectCommandSurfaces(discovery);
  const riskSurfaces = detectRiskSurfaces(discovery, commandSurfaces);
  const pack = generateProofSurfaceCandidate({ discovery, detectedStack, commandSurfaces, riskSurfaces });
  const staxPath = sidecarDir(repoPath);
  const candidatePath = path.join(staxPath, "proof-surfaces.candidate.json");
  const reviewPath = path.join(staxPath, "proof-surfaces.review.md");
  await ensureDirectory(staxPath);
  await fs.writeFile(candidatePath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  await fs.writeFile(reviewPath, renderProofSurfaceReviewPacket(pack), "utf8");
  return { repoPath, candidatePath, reviewPath, pack };
}

export async function approveProofSurfaces(repoPathInput: string): Promise<{ repoPath: string; approvedPath: string; eventPath: string; pack: ProofSurfacePack }> {
  const repoPath = await validateRepoPath(repoPathInput);
  const staxPath = sidecarDir(repoPath);
  const candidatePath = path.join(staxPath, "proof-surfaces.candidate.json");
  const candidate = await readProofSurfacePack(candidatePath);
  const approved: ProofSurfacePack = {
    ...candidate,
    status: "approved",
    approvedAt: nowIso()
  };
  const approvedAt = approved.approvedAt ?? nowIso();
  const approvedPath = path.join(staxPath, "proof-surfaces.json");
  const eventsPath = path.join(staxPath, "events");
  await ensureDirectory(eventsPath);
  await fs.writeFile(approvedPath, `${JSON.stringify(approved, null, 2)}\n`, "utf8");
  const eventPath = path.join(eventsPath, `proof-surface-approved-${approvedAt.replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(
    eventPath,
    `${JSON.stringify(
      {
        schemaVersion: "stax-proof-surface-approval-event-v1",
        approvedAt,
        repoPath,
        candidatePath: ".stax/proof-surfaces.candidate.json",
        approvedPath: ".stax/proof-surfaces.json",
        proofSurfaceCount: approved.proofSurfaces.length
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return { repoPath, approvedPath, eventPath, pack: approved };
}

export async function loadSidecarProofSurfacePack(repoPath: string): Promise<{ pack?: ProofSurfacePack; approved: boolean }> {
  const approvedPath = path.join(sidecarDir(repoPath), "proof-surfaces.json");
  const candidatePath = path.join(sidecarDir(repoPath), "proof-surfaces.candidate.json");
  const approvedRaw = await readTextIfExists(approvedPath);
  if (approvedRaw.trim()) return { pack: ProofSurfacePackSchema.parse(JSON.parse(approvedRaw) as unknown), approved: true };
  const candidateRaw = await readTextIfExists(candidatePath);
  if (candidateRaw.trim()) return { pack: ProofSurfacePackSchema.parse(JSON.parse(candidateRaw) as unknown), approved: false };
  return { approved: false };
}

export async function proofSurfacePromptHint(input: {
  repoPath: string;
  reportText: string;
  unverified: string[];
  risk: string[];
}): Promise<string | undefined> {
  const { pack, approved } = await loadSidecarProofSurfacePack(input.repoPath);
  if (!pack) return undefined;
  const text = [input.reportText, ...input.unverified, ...input.risk].join("\n").toLowerCase();
  const surface = selectSurface(pack, text);
  if (!surface) return undefined;
  const prefix = approved ? "Approved proof surface" : "Candidate proof surface";
  const qualifier = approved ? "" : " This is candidate-only, so treat it as a provisional hint until approved.";
  const commands = surface.commands.length > 0 ? ` Suggested command: ${surface.commands[0]}.` : "";
  return `${prefix} for ${surface.claimType}: ${surface.nextAction ?? `Provide ${surface.requiredEvidence.join(", ")}.`}${commands}${qualifier}`;
}

async function readProofSurfacePack(filePath: string): Promise<ProofSurfacePack> {
  const raw = await readTextIfExists(filePath);
  if (!raw.trim()) throw new Error(`Missing proof-surface candidate: ${filePath}`);
  return ProofSurfacePackSchema.parse(JSON.parse(raw) as unknown);
}

function selectSurface(pack: ProofSurfacePack, text: string) {
  const ordered = [
    [/visual|layout|css|screenshot|rendered|looks good/, "visual_ready"],
    [/publish|sync|deploy|release|ship|merge/, "publish_sync_deploy_ready"],
    [/data|ingest|pipeline|schema|fixture|row|csv|json/, "data_pipeline_ready"],
    [/gold|seed-gold|snapshot|expected/, "gold_fixture_update"],
    [/build|typecheck|compile/, "build_ready"],
    [/test|passed|green|ci/, "tests_passed"],
    [/wrong repo|wrong cwd|repo mismatch/, "repo_identity"]
  ] as const;
  for (const [pattern, claimType] of ordered) {
    if (pattern.test(text)) {
      const found = pack.proofSurfaces.find((surface) => surface.claimType === claimType);
      if (found) return found;
    }
  }
  return pack.proofSurfaces.find((surface) => surface.claimType === "repo_identity");
}
