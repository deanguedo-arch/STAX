import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso, readTextIfExists, sidecarDir, validateRepoPath } from "../sidecar/SidecarRepo.js";
import { detectCommandSurfaces } from "./CommandSurfaceDetector.js";
import { generateProofSurfaceCandidate } from "./ProofSurfaceCandidateGenerator.js";
import { ProofSurfacePackSchema, type ProofSurfacePack } from "./ProofSurfacePackSchemas.js";
import { matchProofSurface } from "./ProofSurfaceMatcher.js";
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
  const surface = matchProofSurface({ pack, text })?.surface;
  if (!surface) return undefined;
  const prefix = approved ? "Approved proof surface" : "Candidate proof surface";
  const qualifier = approved ? "" : " This is candidate-only, so treat it as a provisional hint until approved.";
  const suggestedCommand = suggestedCommandForSurface(surface, text);
  const action = proofSurfaceAction(surface, suggestedCommand);
  const commands = suggestedCommand ? ` Suggested command: ${suggestedCommand}.` : "";
  return `${prefix} for ${surface.claimType}: ${action}${commands}${qualifier}`;
}

function proofSurfaceAction(surface: ProofSurfacePack["proofSurfaces"][number], suggestedCommand?: string): string {
  if (surface.claimType === "tests_passed" && !suggestedCommand) {
    return "Run the relevant test, verification, or compile command through stax:collect in the target repo.";
  }
  return surface.nextAction ?? `Provide ${surface.requiredEvidence.join(", ")}.`;
}

function suggestedCommandForSurface(
  surface: ProofSurfacePack["proofSurfaces"][number],
  text: string
): string | undefined {
  if (!shouldAppendSuggestedCommand(surface)) return undefined;
  const normalizedText = text.toLowerCase();
  return surface.commands.find((command) => normalizedText.includes(command.toLowerCase()));
}

function shouldAppendSuggestedCommand(surface: ProofSurfacePack["proofSurfaces"][number]): boolean {
  if (surface.commands.length === 0) return false;
  if (["course_deploy_ready", "publish_sync_deploy_ready", "release_ready"].includes(surface.claimType)) return false;
  return true;
}

async function readProofSurfacePack(filePath: string): Promise<ProofSurfacePack> {
  const raw = await readTextIfExists(filePath);
  if (!raw.trim()) throw new Error(`Missing proof-surface candidate: ${filePath}`);
  return ProofSurfacePackSchema.parse(JSON.parse(raw) as unknown);
}
